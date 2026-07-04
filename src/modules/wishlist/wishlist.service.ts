import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { mapProductArrays } from '../../common/utils/parse-json-array.util';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async myWishlist(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: { product: { include: { category: true, brand: true, variants: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => ({ ...item, product: mapProductArrays(item.product) }));
  }

  async toggle(userId: string, productId: string) {
    const existing = await this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      await this.prisma.wishlistItem.delete({ where: { id: existing.id } });
      return { added: false, item: null };
    }

    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    const item = await this.prisma.wishlistItem.create({
      data: { userId, productId },
      include: { product: { include: { variants: true } } },
    });
    return { added: true, item: { ...item, product: mapProductArrays(item.product) } };
  }

  async remove(userId: string, id: string) {
    const item = await this.prisma.wishlistItem.findUnique({ where: { id } });
    if (!item || item.userId !== userId) throw new NotFoundException('Wishlist item not found');
    await this.prisma.wishlistItem.delete({ where: { id } });
    return true;
  }
}
