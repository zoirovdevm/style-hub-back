import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AddToCartInput, UpdateCartItemInput } from './dto/cart.input';
import { mapProductArrays } from '../../common/utils/parse-json-array.util';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async myCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      // `variants` must be included here: Product.variants is a non-nullable
      // GraphQL field, so if it's missing from this include, the whole
      // myCart query throws "Cannot return null for non-nullable field
      // Product.variants" and the entire cart silently comes back empty —
      // even though the cart items exist in the database.
      include: { product: { include: { category: true, brand: true, variants: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => ({ ...item, product: mapProductArrays(item.product) }));
  }

  async add(userId: string, input: AddToCartInput) {
    const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
    if (!product || !product.isActive) throw new NotFoundException('Product not found');

    // If this product has size/color variants, validate against that exact
    // combination's stock rather than only the product's aggregate total —
    // a combo can be sold out even while other combos keep the total above 0.
    if (input.size || input.color) {
      const variant = await this.prisma.productVariant.findFirst({
        where: { productId: input.productId, size: input.size ?? '', color: input.color ?? '' },
      });
      if (variant) {
        if (variant.stock < input.quantity) throw new BadRequestException('Bu o‘lcham/rang uchun omborda yetarli mahsulot yo‘q');
      } else if (product.stock < input.quantity) {
        throw new BadRequestException('Omborda yetarli mahsulot yo‘q');
      }
    } else if (product.stock < input.quantity) {
      throw new BadRequestException('Omborda yetarli mahsulot yo‘q');
    }

    // Prisma's compound @@unique (userId, productId, size, color) types its
    // "where" object with non-nullable size/color, even though the columns
    // are optional — so a plain upsert() on that key doesn't compile when
    // size/color can be null. findFirst + create/update sidesteps that
    // while still deduplicating identical cart lines.
    const existing = await this.prisma.cartItem.findFirst({
      where: {
        userId,
        productId: input.productId,
        size: input.size ?? null,
        color: input.color ?? null,
      },
    });

    if (existing) {
      const updated = await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: { increment: input.quantity } },
        include: { product: { include: { variants: true } } },
      });
      return { ...updated, product: mapProductArrays(updated.product) };
    }

    const created = await this.prisma.cartItem.create({
      data: {
        userId,
        productId: input.productId,
        size: input.size,
        color: input.color,
        quantity: input.quantity,
      },
      include: { product: { include: { variants: true } } },
    });
    return { ...created, product: mapProductArrays(created.product) };
  }

  async updateQuantity(userId: string, input: UpdateCartItemInput) {
    const item = await this.prisma.cartItem.findUnique({ where: { id: input.id } });
    if (!item || item.userId !== userId) throw new NotFoundException('Cart item not found');

    const updated = await this.prisma.cartItem.update({
      where: { id: input.id },
      data: { quantity: input.quantity },
      include: { product: { include: { variants: true } } },
    });
    return { ...updated, product: mapProductArrays(updated.product) };
  }

  async remove(userId: string, id: string) {
    const item = await this.prisma.cartItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) throw new NotFoundException('Cart item not found');
    await this.prisma.cartItem.delete({ where: { id } });
    return true;
  }

  async clear(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return true;
  }
}
