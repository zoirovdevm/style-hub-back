import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBannerInput, UpdateBannerInput } from './dto/banner.input';

// Bog'langan yozuvdan faqat havola uchun kerakli maydonlar olinadi —
// izohni models/banner.model.ts da ko'ring.
const BANNER_INCLUDE = {
  product: { select: { id: true, slug: true, title: true, isActive: true } },
  category: { select: { id: true, slug: true, name: true, isActive: true } },
  // Bitta bannerga biriktirilgan bir nechta tovar (linkType = PRODUCTS).
  products: {
    orderBy: { sortOrder: 'asc' },
    include: {
      product: { select: { id: true, slug: true, title: true, images: true, isActive: true } },
    },
  },
} as const;

// `images` ustuni bazada JSON matn ("[\"/uploads/a.jpg\"]") ko'rinishida
// saqlanadi (SQLite'da massiv turi yo'q — schema.prisma izohiga qarang).
// Bu yerda faqat birinchi rasm kerak; matn buzuq bo'lsa null qaytadi va
// hech narsa sinmaydi.
function parseFirstImage(value: unknown): string | null {
  if (Array.isArray(value)) return (value[0] as string) ?? null;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed[0] ?? null) : null;
  } catch {
    return null;
  }
}

@Injectable()
export class BannerService {
  constructor(private readonly prisma: PrismaService) {}

  // Prisma yozuvini GraphQL `Banner` modeliga (tekis maydonlar) o'giradi.
  //
  // Bog'langan mahsulot/kategoriya o'chirilgan yoki yashirilgan bo'lsa
  // (isActive=false), linkType "NONE"ga tushiriladi — aks holda banner
  // xaridorni 404 sahifaga olib borardi.
  private map(banner: any) {
    const product = banner.product?.isActive ? banner.product : null;
    const category = banner.category?.isActive ? banner.category : null;

    // Faqat FAOL tovarlar — yashirilgan tovar bannerdan ochilib,
    // xaridorni "mavjud emas" sahifasiga olib bormasligi uchun.
    const products = (banner.products ?? [])
      .map((row: any) => row.product)
      .filter((p: any) => p?.isActive)
      .map((p: any) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        // `images` bazada JSON matn ko'rinishida saqlanadi — bu yerda
        // faqat birinchi rasm kerak (admin ro'yxatida ko'rsatish uchun).
        image: parseFirstImage(p.images),
      }));

    let linkType: string = banner.linkType ?? 'NONE';
    if (linkType === 'PRODUCT' && !product) linkType = 'NONE';
    if (linkType === 'CATEGORY' && !category) linkType = 'NONE';
    // Hamma biriktirilgan tovar o'chirilgan/yashirilgan bo'lsa, banner
    // bosilmaydigan holatga tushadi.
    if (linkType === 'PRODUCTS' && products.length === 0) linkType = 'NONE';

    return {
      id: banner.id,
      image: banner.image,
      title: banner.title ?? null,
      titleRu: banner.titleRu ?? null,
      linkType,
      isActive: banner.isActive,
      sortOrder: banner.sortOrder,
      productId: banner.productId ?? null,
      productSlug: product?.slug ?? null,
      productTitle: product?.title ?? null,
      categoryId: banner.categoryId ?? null,
      categorySlug: category?.slug ?? null,
      categoryName: category?.name ?? null,
      products,
      createdAt: banner.createdAt,
      updatedAt: banner.updatedAt,
    };
  }

  // Bosh sahifa uchun — faqat faol bannerlar, admin belgilagan tartibda.
  async findActive() {
    const list = await this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: BANNER_INCLUDE,
    });
    return list.map((b) => this.map(b));
  }

  // Admin panel uchun — o'chirilgan (inactive) bannerlar ham ko'rinadi.
  async findAll() {
    const list = await this.prisma.banner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: BANNER_INCLUDE,
    });
    return list.map((b) => this.map(b));
  }

  // linkType bilan tanlangan yozuv mos kelishini tekshiradi va ortiqcha
  // bog'lanishni tozalaydi: masalan "Kategoriya" tanlansa, avval qo'yilgan
  // productId olib tashlanadi — aks holda bazada ikkala havola qolib,
  // keyinchalik qaysi biri ishlashi noaniq bo'lardi.
  private normalizeLink(input: {
    linkType?: string;
    productId?: string | null;
    productIds?: string[] | null;
    categoryId?: string | null;
  }) {
    const linkType = input.linkType ?? 'NONE';
    if (linkType === 'PRODUCT') {
      if (!input.productId) throw new BadRequestException('Banner uchun mahsulotni tanlang');
      return { linkType, productId: input.productId, categoryId: null, productIds: [] as string[] };
    }
    if (linkType === 'PRODUCTS') {
      // Takrorlar olib tashlanadi: admin bir tovarni ikki marta
      // belgilab qo'ysa ham bazaga bitta satr tushadi.
      const ids = Array.from(new Set((input.productIds ?? []).filter(Boolean)));
      if (ids.length === 0) throw new BadRequestException('Banner uchun kamida bitta mahsulotni tanlang');
      return { linkType, productId: null, categoryId: null, productIds: ids };
    }
    if (linkType === 'CATEGORY') {
      if (!input.categoryId) throw new BadRequestException('Banner uchun kategoriyani tanlang');
      return { linkType, productId: null, categoryId: input.categoryId, productIds: [] as string[] };
    }
    return { linkType: 'NONE', productId: null, categoryId: null, productIds: [] as string[] };
  }

  async findById(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id }, include: BANNER_INCLUDE });
    if (!banner) throw new NotFoundException('Banner topilmadi');
    return banner;
  }

  async create(input: CreateBannerInput) {
    const { productIds, ...link } = this.normalizeLink(input);
    const created = await this.prisma.banner.create({
      data: {
        image: input.image,
        title: input.title ?? null,
        titleRu: input.titleRu ?? null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
        ...link,
        // Tanlangan tartib saqlanadi (sortOrder = ro'yxatdagi o'rni).
        products: { create: productIds.map((productId, index) => ({ productId, sortOrder: index })) },
      },
      include: BANNER_INCLUDE,
    });
    return this.map(created);
  }

  async update(id: string, input: UpdateBannerInput) {
    const existing = await this.findById(id);
    // Tahrirlashda faqat yuborilgan maydonlar o'zgaradi. linkType
    // yuborilmagan bo'lsa — bazadagisi saqlanadi (va u bilan birga
    // tegishli productId/categoryId ham qayta tekshiriladi).
    const { productIds, ...link } = this.normalizeLink({
      linkType: input.linkType ?? existing.linkType,
      productId: input.productId !== undefined ? input.productId : existing.productId,
      productIds:
        input.productIds !== undefined
          ? input.productIds
          : (existing.products ?? []).map((row: any) => row.productId),
      categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
    });

    const updated = await this.prisma.banner.update({
      where: { id },
      data: {
        ...(input.image !== undefined ? { image: input.image } : {}),
        ...(input.title !== undefined ? { title: input.title || null } : {}),
        ...(input.titleRu !== undefined ? { titleRu: input.titleRu || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...link,
        // Ro'yxat butunlay qayta yoziladi: eski bog'lanishlar o'chib,
        // yangi tanlov o'z tartibi bilan qo'yiladi. Bu "qaysi biri
        // qo'shildi/olib tashlandi" ni qidirishdan ko'ra sodda va
        // xatosiz — bog'lanishda saqlanadigan boshqa ma'lumot yo'q.
        products: {
          deleteMany: {},
          create: productIds.map((productId, index) => ({ productId, sortOrder: index })),
        },
      },
      include: BANNER_INCLUDE,
    });
    return this.map(updated);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.banner.delete({ where: { id } });
    return true;
  }
}
