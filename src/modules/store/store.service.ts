import { Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStoreInput, UpdateStoreInput } from './dto/store.input';

const LOW_STOCK_THRESHOLD = 5;

// Kod uchun adashtirmaydigan belgilar (0/O, 1/I kabi o'xshashlari olib
// tashlangan) — magazinchi telefonda terganda xato qilmasin.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.store.findMany({ orderBy: { name: 'asc' } });
  }

  // ── Bot kirish kodi ─────────────────────────────────────────

  private randomCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
  }

  // Magazinda kod bo'lmasa yaratib qo'yadi (unique to'qnashuvda qayta
  // urinadi). Eski (kod qo'shilishidan oldin yaratilgan) magazinlar uchun
  // ham avtomatik ishlaydi.
  private async ensureAccessCode(store: { id: string; accessCode: string | null }): Promise<string> {
    if (store.accessCode) return store.accessCode;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const updated = await this.prisma.store.update({
          where: { id: store.id },
          data: { accessCode: this.randomCode() },
        });
        return updated.accessCode!;
      } catch {
        // unique to'qnashuv — qayta urinamiz
      }
    }
    throw new Error('Access code generation failed');
  }

  // Kodni almashtirish — eski kod darhol ishlamay qoladi. Allaqachon
  // ulangan sotuvchilar uzilmaydi (ularni alohida "uzish" tugmasi uzadi).
  async regenerateAccessCode(id: string): Promise<string> {
    await this.findById(id);
    await this.prisma.store.update({ where: { id }, data: { accessCode: null } });
    return this.ensureAccessCode({ id, accessCode: null });
  }

  // Shu magazinga ulangan barcha Telegram akkauntlarni uzish — ular botga
  // qayta kirish uchun yangi kodni kiritishi kerak bo'ladi.
  async revokeSellers(id: string): Promise<boolean> {
    await this.findById(id);
    await this.prisma.telegramStoreLink.deleteMany({ where: { storeId: id } });
    return true;
  }

  async findById(id: string) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  create(input: CreateStoreInput) {
    return this.prisma.store.create({
      data: { ...input, slug: slugify(input.name, { lower: true, strict: true }) },
    });
  }

  async update(id: string, input: UpdateStoreInput) {
    await this.findById(id);
    return this.prisma.store.update({
      where: { id },
      data: {
        ...input,
        ...(input.name ? { slug: slugify(input.name, { lower: true, strict: true }) } : {}),
      },
    });
  }

  // O'chirishda unga bog'langan tovarlar bazadan BUTUNLAY o'chirilmaydi —
  // shunday qilinsa, agar shu tovarlardan biror mijoz allaqachon buyurtma
  // qilgan bo'lsa (OrderItem orqali bog'langan), o'chirish xatolik berardi
  // yoki eski buyurtma tarixidagi ma'lumot buzilardi. Shuning o'rniga tovar
  // saytdan (do'kondan) yashiriladi (isActive=false) va storeId bo'shatiladi
  // (magazin o'chgach "magazinsiz" bo'lib qoladi). Admin keyin
  // "Tovarlar" bo'limida bu yashirilgan tovarlarni ko'radi va xohlasa
  // birma-bir butunlay o'chirishi mumkin (product.service.ts hardDelete).
  async remove(id: string) {
    await this.findById(id);
    await this.prisma.product.updateMany({
      where: { storeId: id },
      data: { storeId: null, isActive: false },
    });
    await this.prisma.store.delete({ where: { id } });
    return true;
  }

  // ── Statistika ──────────────────────────────────────────────

  // sizes/colors/images SQLite'da JSON-satr bo'lib saqlanadi (product.service
  // bilan bir xil yechim) — GraphQL string[] kutadi, shu yerda ochamiz.
  private parseArray(value: unknown): string[] {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private mapProduct<T extends Record<string, unknown>>(product: T) {
    return {
      ...product,
      sizes: this.parseArray(product.sizes),
      colors: this.parseArray(product.colors),
      images: this.parseArray(product.images),
      variants: (product as any).variants ?? [],
    };
  }

  // Bitta magazin uchun yig'ma raqamlarni hisoblash. Tushum (revenue) faqat
  // TO'LANGAN buyurtmalardagi shu magazin tovarlari bo'yicha: narx x soni.
  // "Mening ulushim" (myShare) shu tushumning commissionPercent foizi —
  // magazinchi bilan kelishilgan komissiya asosida.
  private async computeStats(store: {
    id: string;
    name: string;
    slug: string;
    accessCode: string | null;
    commissionPercent: number;
  }) {
    const [products, paidItems, links, accessCode] = await Promise.all([
      this.prisma.product.findMany({
        where: { storeId: store.id, isActive: true },
        select: { stock: true, soldCount: true },
      }),
      this.prisma.orderItem.findMany({
        where: { product: { storeId: store.id }, order: { paymentStatus: 'PAID' } },
        select: { price: true, quantity: true },
      }),
      this.prisma.telegramStoreLink.findMany({ where: { storeId: store.id } }),
      this.ensureAccessCode(store),
    ]);

    const revenue = paidItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      accessCode,
      sellers: links.map((l) => l.telegramUsername || `ID:${l.telegramUserId}`),
      totalProducts: products.length,
      totalStock: products.reduce((sum, p) => sum + p.stock, 0),
      totalSold: products.reduce((sum, p) => sum + p.soldCount, 0),
      revenue,
      commissionPercent: store.commissionPercent,
      myShare: revenue * (store.commissionPercent / 100),
      lowStockCount: products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD).length,
    };
  }

  // Magazinlar ro'yxati sahifasi uchun: har bir magazin + raqamlari.
  // Magazinlar soni oz bo'ladi, shuning uchun birma-bir hisoblash yetarli.
  async statsForAll() {
    const stores = await this.findAll();
    return Promise.all(stores.map((s) => this.computeStats(s)));
  }

  // Magazin ichki sahifasi: statistika + shu magazinning barcha tovarlari.
  async overview(id: string) {
    const store = await this.findById(id);
    const [stats, products] = await Promise.all([
      this.computeStats(store),
      this.prisma.product.findMany({
        where: { storeId: id, isActive: true },
        orderBy: { createdAt: 'desc' },
        include: { category: true, brand: true, store: true, variants: true },
      }),
    ]);
    return { stats, products: products.map((p) => this.mapProduct(p)) };
  }
}
