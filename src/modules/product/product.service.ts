import { Injectable, NotFoundException } from '@nestjs/common';
import slugify from 'slugify';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductInput, UpdateProductInput, VariantInput } from './dto/product.input';
import { ProductFilterInput, ProductSort } from './dto/product-filter.input';

const PRODUCT_INCLUDE = { category: true, brand: true, variants: true } as const;

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * sizes/colors/images are stored as JSON-encoded strings (SQLite has no
   * native array/Json type) — these helpers convert between the DB's
   * string representation and the string[] shape GraphQL/the rest of the
   * app expects.
   */
  private serializeArray(value?: string[] | null): string {
    return JSON.stringify(value ?? []);
  }

  private mapProduct<T extends { sizes: unknown; colors: unknown; images: unknown }>(product: T) {
    return {
      ...product,
      sizes: this.parseArray((product as any).sizes),
      colors: this.parseArray((product as any).colors),
      images: this.parseArray((product as any).images),
      variants: (product as any).variants ?? [],
    };
  }

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

  /** Total stock is derived from variants whenever variants are provided, so
   * dashboard/low-stock/cart code that only reads Product.stock keeps
   * working without changes. Falls back to the plain `stock` field for
   * products with no size/color variants (e.g. a one-size accessory). */
  private aggregateStock(variants: VariantInput[] | undefined, fallback: number): number {
    if (!variants || variants.length === 0) return fallback;
    return variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0);
  }

  async findAll(filter: ProductFilterInput) {
    const where: any = { isActive: true };
    // Every optional filter (size, color, search) is pushed as its own
    // AND-ed clause below instead of sharing a single top-level `where.OR` —
    // previously `sizes` and `search` both wrote to `where.OR`, so combining
    // a size filter with a search term silently turned "size L AND matches
    // search" into "size L OR matches search", returning wrong results.
    // Keeping each filter in its own `and[]` entry means size, color, and
    // search always combine correctly no matter which ones are active.
    const and: any[] = [];

    if (filter.categorySlug) where.category = { slug: filter.categorySlug };
    if (filter.brandSlug) where.brand = { slug: filter.brandSlug };
    if (filter.onlyFeatured) where.isFeatured = true;

    // sizes/colors are JSON-encoded strings like ["S","M","L"] — matching
    // the quoted form avoids "S" incorrectly matching inside "XS".
    if (filter.sizes?.length) {
      and.push({ OR: filter.sizes.map((s) => ({ sizes: { contains: `"${s}"` } })) });
    }
    if (filter.colors?.length) {
      and.push({ OR: filter.colors.map((c) => ({ colors: { contains: `"${c}"` } })) });
    }

    if (filter.minPrice != null || filter.maxPrice != null) {
      where.price = {};
      if (filter.minPrice != null) where.price.gte = filter.minPrice;
      if (filter.maxPrice != null) where.price.lte = filter.maxPrice;
    }
    if (filter.search) {
      and.push({
        OR: [
          { title: { contains: filter.search } },
          { titleRu: { contains: filter.search } },
          { description: { contains: filter.search } },
        ],
      });
    }
    if (and.length) where.AND = and;

    const orderBy = this.resolveSort(filter.sort);

    const [list, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
        include: PRODUCT_INCLUDE,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { list: list.map((p) => this.mapProduct(p)), total };
  }

  private resolveSort(sort: ProductSort) {
    switch (sort) {
      case ProductSort.PRICE_ASC:
        return { price: 'asc' as const };
      case ProductSort.PRICE_DESC:
        return { price: 'desc' as const };
      case ProductSort.MOST_POPULAR:
        return { soldCount: 'desc' as const };
      case ProductSort.TOP_RATED:
        return { rating: 'desc' as const };
      case ProductSort.NEWEST:
      default:
        return { createdAt: 'desc' as const };
    }
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.product.update({
      where: { id: product.id },
      data: { viewCount: { increment: 1 } },
    });

    return this.mapProduct(product);
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.mapProduct(product);
  }

  async create(input: CreateProductInput) {
    const { variants, ...rest } = input;
    const product = await this.prisma.product.create({
      data: {
        ...rest,
        stock: this.aggregateStock(variants, input.stock),
        sizes: this.serializeArray(input.sizes),
        colors: this.serializeArray(input.colors),
        images: this.serializeArray(input.images),
        slug: `${slugify(input.title, { lower: true, strict: true })}-${Date.now().toString(36)}`,
        ...(variants?.length
          ? { variants: { create: variants.map((v) => ({ size: v.size, color: v.color, stock: v.stock })) } }
          : {}),
      },
      include: PRODUCT_INCLUDE,
    });
    return this.mapProduct(product);
  }

  async update(id: string, input: UpdateProductInput) {
    await this.findById(id);
    const { variants, ...rest } = input;

    // Cast to `any` here: UpdateProductInput's optional `categoryId`/`brandId`
    // scalars match Prisma's "unchecked" update shape, but TS's XOR between
    // ProductUpdateInput/ProductUncheckedUpdateInput can't resolve that when
    // spread from a DTO with every field optional — this is a well-known
    // Prisma+TS friction point for partial update DTOs, not a real type bug.
    const data: any = {
      ...rest,
      ...(input.sizes ? { sizes: this.serializeArray(input.sizes) } : {}),
      ...(input.colors ? { colors: this.serializeArray(input.colors) } : {}),
      ...(input.images ? { images: this.serializeArray(input.images) } : {}),
      ...(variants
        ? {
            stock: this.aggregateStock(variants, input.stock ?? 0),
            // Simplest correct approach for a small admin-entered grid:
            // wipe and recreate rather than diff/upsert each row.
            variants: {
              deleteMany: {},
              create: variants.map((v) => ({ size: v.size, color: v.color, stock: v.stock })),
            },
          }
        : {}),
    };

    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: PRODUCT_INCLUDE,
    });
    return this.mapProduct(product);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
    return true;
  }

  async bestSellers(limit = 5) {
    const list = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { soldCount: 'desc' },
      take: limit,
      include: PRODUCT_INCLUDE,
    });
    return list.map((p) => this.mapProduct(p));
  }

  async lowStock(threshold = 5, limit = 10) {
    const list = await this.prisma.product.findMany({
      where: { isActive: true, stock: { lte: threshold } },
      orderBy: { stock: 'asc' },
      take: limit,
      include: PRODUCT_INCLUDE,
    });
    return list.map((p) => this.mapProduct(p));
  }

  countAll() {
    return this.prisma.product.count({ where: { isActive: true } });
  }
}
