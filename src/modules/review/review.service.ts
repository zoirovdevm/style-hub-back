import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewInput } from './dto/create-review.input';
import { Role } from '../../common/enums/role.enum';
import { OrderStatus } from '../../common/enums/order.enum';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  findByProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Eligible to review = admin (moderation/testing convenience), or a real
  // buyer: someone with at least one non-cancelled order that contains this
  // exact product. Cancelled orders don't count — they never actually
  // received the item. Anything else (PENDING/PROCESSING/SHIPPED/DELIVERED)
  // does, since this storefront's payment confirmation is a manual/Telegram
  // -bot flow that can leave a real order sitting in an earlier status for a
  // while — requiring DELIVERED specifically would lock out genuine buyers
  // for no good reason.
  async canUserReview(userId: string, productId: string, role: Role): Promise<boolean> {
    if (role === Role.ADMIN) return true;

    const order = await this.prisma.order.findFirst({
      where: {
        userId,
        status: { not: OrderStatus.CANCELLED },
        items: { some: { productId } },
      },
      select: { id: true },
    });
    return !!order;
  }

  // Each submission creates a brand-new review row — a user can leave more
  // than one review for the same product (previously this used upsert,
  // which silently overwrote the user's earlier review instead of adding
  // a new one).
  //
  // The eligibility check is enforced HERE, server-side — not just hidden
  // in the frontend UI — so it can't be bypassed by calling the mutation
  // directly. Whoever isn't a purchaser or an admin gets a real error, not
  // a silently-accepted review.
  async create(userId: string, role: Role, input: CreateReviewInput) {
    const eligible = await this.canUserReview(userId, input.productId, role);
    if (!eligible) {
      throw new ForbiddenException(
        "Sharh qoldirish uchun avval ushbu mahsulotni sotib olishingiz kerak.",
      );
    }

    const review = await this.prisma.review.create({
      data: { productId: input.productId, userId, rating: input.rating, comment: input.comment, image: input.image },
      include: { user: true },
    });

    await this.recalculateProductRating(input.productId);
    return review;
  }

  async delete(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) return false;

    await this.prisma.review.delete({ where: { id } });
    await this.recalculateProductRating(review.productId);
    return true;
  }

  // Product.rating/reviewsCount are denormalized copies kept in sync here —
  // every product-list/card query reads these two plain fields instead of
  // aggregating the reviews table on every single request.
  private async recalculateProductRating(productId: string) {
    const { _avg, _count } = await this.prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        rating: _avg.rating ?? 0,
        reviewsCount: _count.rating,
      },
    });
  }
}
