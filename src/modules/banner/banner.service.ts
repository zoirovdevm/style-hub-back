import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBannerInput, UpdateBannerInput } from './dto/banner.input';

// Bog'langan yozuvdan faqat havola uchun kerakli maydonlar olinadi —
// izohni models/banner.model.ts da ko'ring.
const BANNER_INCLUDE = {
  product: { select: { id: true, slug: true, title: true, isActive: true } },
  category: { select: { id: true, slug: true, name: true, isActive: true } },
} as const;

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

    let linkType: string = banner.linkType ?? 'NONE';
    if (linkType === 'PRODUCT' && !product) linkType = 'NONE';
    if (linkType === 'CATEGORY' && !category) linkType = 'NONE';

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
  private normalizeLink(input: { linkType?: string; productId?: string | null; categoryId?: string | null }) {
    const linkType = input.linkType ?? 'NONE';
    if (linkType === 'PRODUCT') {
      if (!input.productId) throw new BadRequestException('Banner uchun mahsulotni tanlang');
      return { linkType, productId: input.productId, categoryId: null };
    }
    if (linkType === 'CATEGORY') {
      if (!input.categoryId) throw new BadRequestException('Banner uchun kategoriyani tanlang');
      return { linkType, productId: null, categoryId: input.categoryId };
    }
    return { linkType: 'NONE', productId: null, categoryId: null };
  }

  async findById(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id }, include: BANNER_INCLUDE });
    if (!banner) throw new NotFoundException('Banner topilmadi');
    return banner;
  }

  async create(input: CreateBannerInput) {
    const link = this.normalizeLink(input);
    const created = await this.prisma.banner.create({
      data: {
        image: input.image,
        title: input.title ?? null,
        titleRu: input.titleRu ?? null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
        ...link,
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
    const link = this.normalizeLink({
      linkType: input.linkType ?? existing.linkType,
      productId: input.productId !== undefined ? input.productId : existing.productId,
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
