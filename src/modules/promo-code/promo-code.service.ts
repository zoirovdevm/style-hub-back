import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePromoCodeInput, UpdatePromoCodeInput } from './dto/promo-code.input';
import { resolveUnitPrice } from '../../common/utils/variant-price.util';

// Bog'langan yozuvlardan faqat ro'yxatda ko'rsatish uchun kerakli
// maydonlar olinadi — izohni models/promo-code.model.ts da ko'ring.
const PROMO_INCLUDE = {
  categories: { include: { category: { select: { id: true, name: true } } } },
  products: { include: { product: { select: { id: true, title: true } } } },
} as const;

// Xaridor kiritadigan bitta tovar qatori (narxi bilan).
export interface PricedItem {
  productId: string;
  categoryId: string;
  unitPrice: number;
  quantity: number;
}

// Kodni tekshirish natijasi.
export interface PromoEvaluation {
  valid: boolean;
  message?: string;
  code?: string;
  promoId?: string;
  eligibleAmount: number;
  discount: number;
  total: number;
}

// TELEFON RAQAMINI BIR KO'RINISHGA KELTIRISH.
//
// "Bitta raqam — bitta marta" qoidasi shunga tayanadi. Bazada raqam
// turlicha yozilgan bo'lishi mumkin: "+998 99 213 28 01", "998992132801",
// "992132801". Hammasi bitta odam, shuning uchun taqqoslashdan oldin
// faqat raqamlar qoldiriladi va doim "998" bilan boshlanadigan 12 xonali
// ko'rinishga keltiriladi.
export function normalizePhone(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 9) return `998${digits}`;
  if (digits.length > 12 && digits.startsWith('998')) return digits.slice(0, 12);
  return digits;
}

@Injectable()
export class PromoCodeService {
  constructor(private readonly prisma: PrismaService) {}

  private map(promo: any) {
    return {
      id: promo.id,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      maxDiscount: promo.maxDiscount ?? null,
      minOrderAmount: promo.minOrderAmount ?? null,
      startsAt: promo.startsAt ?? null,
      endsAt: promo.endsAt ?? null,
      isActive: promo.isActive,
      scope: promo.scope,
      usedCount: promo.usedCount ?? 0,
      categories: (promo.categories ?? [])
        .map((row: any) => row.category)
        .filter(Boolean)
        .map((c: any) => ({ id: c.id, name: c.name })),
      products: (promo.products ?? [])
        .map((row: any) => row.product)
        .filter(Boolean)
        .map((p: any) => ({ id: p.id, name: p.title })),
      createdAt: promo.createdAt,
      updatedAt: promo.updatedAt,
    };
  }

  // ── Admin ──────────────────────────────────────────────────────────
  async findAll() {
    const list = await this.prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: PROMO_INCLUDE,
    });
    return list.map((p) => this.map(p));
  }

  private parseDate(value?: string | null): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Qamrovga qarab ortiqcha bog'lanishlarni tozalaydi: "Hamma tovarga"
  // tanlansa, avval qo'yilgan kategoriya/tovar ro'yxatlari o'chiriladi —
  // aks holda bazada ikkala ma'lumot qolib, keyin qaysi biri ishlashi
  // noaniq bo'lardi.
  private normalizeScope(input: { scope?: string; categoryIds?: string[] | null; productIds?: string[] | null }) {
    const scope = input.scope ?? 'ALL';
    if (scope === 'CATEGORIES') {
      const ids = Array.from(new Set((input.categoryIds ?? []).filter(Boolean)));
      if (ids.length === 0) throw new BadRequestException('Kamida bitta kategoriyani tanlang');
      return { scope, categoryIds: ids, productIds: [] as string[] };
    }
    if (scope === 'PRODUCTS') {
      const ids = Array.from(new Set((input.productIds ?? []).filter(Boolean)));
      if (ids.length === 0) throw new BadRequestException('Kamida bitta mahsulotni tanlang');
      return { scope, categoryIds: [] as string[], productIds: ids };
    }
    return { scope: 'ALL', categoryIds: [] as string[], productIds: [] as string[] };
  }

  async create(input: CreatePromoCodeInput) {
    const code = input.code.trim().toUpperCase();
    const exists = await this.prisma.promoCode.findUnique({ where: { code } });
    if (exists) throw new BadRequestException('Bunday promokod allaqachon mavjud');

    const { scope, categoryIds, productIds } = this.normalizeScope(input);

    const created = await this.prisma.promoCode.create({
      data: {
        code,
        discountType: input.discountType ?? 'PERCENT',
        discountValue: input.discountValue,
        maxDiscount: input.maxDiscount ?? null,
        minOrderAmount: input.minOrderAmount ?? null,
        startsAt: this.parseDate(input.startsAt),
        endsAt: this.parseDate(input.endsAt),
        isActive: input.isActive ?? true,
        scope,
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        products: { create: productIds.map((productId) => ({ productId })) },
      },
      include: PROMO_INCLUDE,
    });
    return this.map(created);
  }

  async findById(id: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id }, include: PROMO_INCLUDE });
    if (!promo) throw new NotFoundException('Promokod topilmadi');
    return promo;
  }

  async update(id: string, input: UpdatePromoCodeInput) {
    const existing: any = await this.findById(id);

    // Yuborilmagan maydonlar bazadagicha qoladi.
    const { scope, categoryIds, productIds } = this.normalizeScope({
      scope: input.scope ?? existing.scope,
      categoryIds:
        input.categoryIds !== undefined
          ? input.categoryIds
          : (existing.categories ?? []).map((row: any) => row.categoryId),
      productIds:
        input.productIds !== undefined
          ? input.productIds
          : (existing.products ?? []).map((row: any) => row.productId),
    });

    const code = input.code !== undefined ? input.code.trim().toUpperCase() : undefined;
    if (code && code !== existing.code) {
      const clash = await this.prisma.promoCode.findUnique({ where: { code } });
      if (clash) throw new BadRequestException('Bunday promokod allaqachon mavjud');
    }

    const updated = await this.prisma.promoCode.update({
      where: { id },
      data: {
        ...(code !== undefined ? { code } : {}),
        ...(input.discountType !== undefined ? { discountType: input.discountType } : {}),
        ...(input.discountValue !== undefined ? { discountValue: input.discountValue } : {}),
        ...(input.maxDiscount !== undefined ? { maxDiscount: input.maxDiscount || null } : {}),
        ...(input.minOrderAmount !== undefined ? { minOrderAmount: input.minOrderAmount || null } : {}),
        ...(input.startsAt !== undefined ? { startsAt: this.parseDate(input.startsAt) } : {}),
        ...(input.endsAt !== undefined ? { endsAt: this.parseDate(input.endsAt) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        scope,
        // Ro'yxat butunlay qayta yoziladi — bannerdagi bilan bir xil
        // yondashuv: bog'lanishda saqlanadigan boshqa ma'lumot yo'q,
        // shuning uchun "qaysi biri qo'shildi/olib tashlandi" ni
        // qidirishdan ko'ra sodda va xatosiz.
        categories: { deleteMany: {}, create: categoryIds.map((categoryId) => ({ categoryId })) },
        products: { deleteMany: {}, create: productIds.map((productId) => ({ productId })) },
      },
      include: PROMO_INCLUDE,
    });
    return this.map(updated);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.promoCode.delete({ where: { id } });
    return true;
  }

  // ── Xaridor tomoni ─────────────────────────────────────────────────

  // Buyurtma qatorlarini savatdan (yoki "hoziroq sotib olish" dan)
  // yig'adi va narxlarini SERVERDA hisoblaydi — brauzerdan kelgan
  // narxga hech qachon ishonilmaydi.
  async resolveItems(
    userId: string,
    input: { itemIds?: string[] | null; buyNowProductId?: string | null; buyNowSize?: string | null; buyNowColor?: string | null; buyNowQuantity?: number | null },
  ): Promise<PricedItem[]> {
    if (input.buyNowProductId) {
      const product: any = await this.prisma.product.findUnique({
        where: { id: input.buyNowProductId },
        include: { variants: true },
      });
      if (!product) return [];
      return [
        {
          productId: product.id,
          categoryId: product.categoryId,
          unitPrice: resolveUnitPrice(product, input.buyNowSize ?? null, input.buyNowColor ?? null),
          quantity: input.buyNowQuantity ?? 1,
        },
      ];
    }

    const where =
      input.itemIds && input.itemIds.length > 0 ? { userId, id: { in: input.itemIds } } : { userId };
    const rows: any[] = await this.prisma.cartItem.findMany({
      where,
      include: { product: { include: { variants: true } } },
    });
    return rows.map((row) => ({
      productId: row.productId,
      categoryId: row.product.categoryId,
      unitPrice: resolveUnitPrice(row.product, row.size, row.color),
      quantity: row.quantity,
    }));
  }

  // KODNI TEKSHIRISH VA CHEGIRMANI HISOBLASH.
  //
  // Bitta joyda turadi va IKKALA tomon ham shuni chaqiradi: to'lovdan
  // oldingi ko'rsatma (preview) ham, buyurtma yaratish ham. Shuning uchun
  // xaridor ko'rgan chegirma bilan bazaga yoziladigani hech qachon
  // farq qilmaydi.
  async evaluate(codeRaw: string, phoneRaw: string, items: PricedItem[]): Promise<PromoEvaluation> {
    const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const fail = (message: string): PromoEvaluation => ({
      valid: false,
      message,
      eligibleAmount: 0,
      discount: 0,
      total,
    });

    const code = (codeRaw ?? '').trim().toUpperCase();
    if (!code) return fail('Promokodni kiriting');
    if (items.length === 0) return fail('Savat bo‘sh');

    const promo: any = await this.prisma.promoCode.findUnique({
      where: { code },
      include: PROMO_INCLUDE,
    });
    if (!promo || !promo.isActive) return fail('Bunday promokod topilmadi');

    const now = new Date();
    if (promo.startsAt && now < promo.startsAt) return fail('Promokod hali boshlanmagan');
    if (promo.endsAt && now > promo.endsAt) return fail('Promokod muddati tugagan');

    const phone = normalizePhone(phoneRaw);
    if (!phone) return fail('Telefon raqamini kiriting');

    const used = await this.prisma.promoCodeUsage.findUnique({
      where: { promoCodeId_phone: { promoCodeId: promo.id, phone } },
    });
    if (used) return fail('Bu promokod ushbu raqamda allaqachon ishlatilgan');

    if (promo.minOrderAmount && total < promo.minOrderAmount) {
      return fail('Buyurtma summasi promokod uchun yetarli emas');
    }

    // Qamrov: kod faqat tanlangan kategoriya/tovarlarga tushadi.
    const categoryIds = new Set((promo.categories ?? []).map((row: any) => row.categoryId));
    const productIds = new Set((promo.products ?? []).map((row: any) => row.productId));
    const eligible = items.filter((item) => {
      if (promo.scope === 'CATEGORIES') return categoryIds.has(item.categoryId);
      if (promo.scope === 'PRODUCTS') return productIds.has(item.productId);
      return true;
    });
    const eligibleAmount = eligible.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    if (eligibleAmount <= 0) return fail('Promokod savatdagi tovarlarga amal qilmaydi');

    let discount =
      promo.discountType === 'AMOUNT'
        ? Math.min(promo.discountValue, eligibleAmount)
        : (eligibleAmount * promo.discountValue) / 100;
    if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
    // Tiyinlar bilan ovora bo'lmaymiz — so'mgacha yaxlitlanadi va hech
    // qachon umumiy summadan oshmaydi.
    discount = Math.min(Math.round(discount), total);

    return {
      valid: true,
      code: promo.code,
      promoId: promo.id,
      eligibleAmount,
      discount,
      total: total - discount,
    };
  }

  // Buyurtma yaratilgach chaqiriladi (o'sha tranzaksiya ichida).
  // `promoCodeId_phone` ustidagi UNIQUE indeks tufayli ikkinchi marta
  // yozishga urinish bazaning o'zida xatolik beradi — ya'ni "bitta
  // raqam bitta marta" qoidasi dastur mantig'iga emas, bazaga
  // tayanadi.
  async recordUsage(
    tx: any,
    args: { promoId: string; phone: string; userId?: string | null; orderId?: string | null; discount: number },
  ) {
    await tx.promoCodeUsage.create({
      data: {
        promoCodeId: args.promoId,
        phone: normalizePhone(args.phone),
        userId: args.userId ?? null,
        orderId: args.orderId ?? null,
        discount: args.discount,
      },
    });
    await tx.promoCode.update({
      where: { id: args.promoId },
      data: { usedCount: { increment: 1 } },
    });
  }
}
