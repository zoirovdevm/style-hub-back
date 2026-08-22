import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderInput } from './dto/order.input';
import { OrderFilterInput } from './dto/order-filter.input';
import { UpdateOrderStatusInput } from './dto/update-order-status.input';
import { OrderStatus, PaymentStatus } from '../../common/enums/order.enum';
import { mapProductArrays } from '../../common/utils/parse-json-array.util';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  private generateOrderNumber() {
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${stamp}-${rand}`;
  }

  /** Maps sizes/colors/images back to arrays on every product nested inside order.items */
  private mapOrderProducts<T extends { items?: any[] }>(order: T): T {
    if (!order?.items) return order;
    return {
      ...order,
      items: order.items.map((item) => (item.product ? { ...item, product: mapProductArrays(item.product) } : item)),
    };
  }

  // Shared by updateStatus (cancel/reactivate a *paid* order) and
  // setPaymentStatus (mark paid/unpaid) — the only two events that are
  // allowed to actually move inventory. 'decrease' validates there's enough
  // stock left and throws if not; 'increase' (giving stock back) never
  // needs to validate.
  private async adjustInventory(
    tx: any,
    items: { productId: string; size: string | null; color: string | null; quantity: number; title: string }[],
    direction: 'increase' | 'decrease',
  ) {
    const sign = direction === 'increase' ? 1 : -1;
    for (const item of items) {
      if (item.size || item.color) {
        const variant = await tx.productVariant.findFirst({
          where: { productId: item.productId, size: item.size ?? '', color: item.color ?? '' },
        });
        if (variant) {
          if (direction === 'decrease' && variant.stock < item.quantity) {
            throw new BadRequestException(
              `"${item.title}" (${[item.size, item.color].filter(Boolean).join(' / ')}) uchun omborda yetarli miqdor yo‘q`,
            );
          }
          await tx.productVariant.update({ where: { id: variant.id }, data: { stock: { increment: sign * item.quantity } } });
        }
      }

      if (direction === 'decrease') {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product && product.stock < item.quantity) {
          throw new BadRequestException(`"${item.title}" uchun omborda yetarli miqdor yo‘q`);
        }
      }

      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { increment: sign * item.quantity },
          // Opposite sign from stock, not the same one: when stock LEAVES
          // the warehouse (decrease, sign -1) that's a sale, so soldCount
          // should go UP; when stock comes BACK (increase, sign +1, e.g. a
          // cancelled/refunded order) that item is no longer "sold", so
          // soldCount should go DOWN. The previous version used `sign` for
          // both fields, which moved them in the same direction instead of
          // opposite ones — every cancel/reactivate or paid/unpaid toggle
          // nudged soldCount the wrong way, eventually driving it negative
          // (seen in production as e.g. "-5 sotildi").
          soldCount: { increment: -sign * item.quantity },
        },
      });
    }
  }

  async createFromCart(userId: string, input: CreateOrderInput) {
    // `itemIds` (from the cart page's selection checkboxes) scopes this to
    // only those rows — always ANDed with `userId` so a caller can never
    // check out someone else's cart items by passing their ids. Omitted
    // (the "1-click buy" flow, or checkout reached with nothing selected)
    // falls back to the whole cart, exactly like before this existed.
    const cartItemWhere =
      input.itemIds && input.itemIds.length > 0
        ? { userId, id: { in: input.itemIds } }
        : { userId };

    const cartItems = await this.prisma.cartItem.findMany({
      where: cartItemWhere,
      include: { product: { include: { variants: true } } },
    });

    if (cartItems.length === 0) throw new BadRequestException('Savatcha bo‘sh');

    // Deliberately does NOT touch inventory here — only a sanity check that
    // the item is at least theoretically available. Actual stock reservation
    // happens in setPaymentStatus() once the admin confirms the Telegram
    // payment. Decrementing stock at order-placement time would let anyone
    // lock up the last piece of something just by clicking "buyurtma
    // berish" without ever actually paying, starving real paying buyers.
    for (const item of cartItems) {
      if (!item.product.isActive) {
        throw new BadRequestException(`"${item.product.title}" endi mavjud emas`);
      }

      const variant = item.size || item.color
        ? item.product.variants.find((v) => v.size === (item.size ?? '') && v.color === (item.color ?? ''))
        : null;
      const available = variant ? variant.stock : item.product.stock;

      if (available < item.quantity) {
        throw new BadRequestException(
          item.size || item.color
            ? `"${item.product.title}" (${[item.size, item.color].filter(Boolean).join(' / ')}) uchun omborda yetarli miqdor yo‘q`
            : `"${item.product.title}" uchun omborda yetarli miqdor yo‘q`,
        );
      }
    }

    const totalAmount = cartItems.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0,
    );

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: this.generateOrderNumber(),
          userId,
          totalAmount,
          deliveryAddress: input.deliveryAddress,
          deliveryCity: input.deliveryCity,
          phone: input.phone,
          note: input.note,
          paymentMethod: input.paymentMethod,
          paymentStatus: PaymentStatus.PENDING,
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              title: item.product.title,
              price: item.product.price,
              size: item.size,
              color: item.color,
              quantity: item.quantity,
            })),
          },
        },
        include: { items: { include: { product: { include: { variants: true } } } } },
      });

      // Only clears the items that were actually ordered — a partial
      // (selected-items-only) checkout must leave the untouched, unselected
      // cart rows behind for the buyer to check out later, not wipe the
      // whole cart out from under them.
      await tx.cartItem.deleteMany({ where: cartItemWhere });

      return created;
    });

    return this.mapOrderProducts(order);
  }

  async myOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { items: { include: { product: { include: { variants: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((o) => this.mapOrderProducts(o));
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: { include: { variants: true } } } }, user: true, payment: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.mapOrderProducts(order);
  }

  async findAll(filter: OrderFilterInput) {
    const where: any = {};
    if (filter.status) where.status = filter.status;
    if (filter.paymentStatus) where.paymentStatus = filter.paymentStatus;
    if (filter.search) {
      where.OR = [
        { orderNumber: { contains: filter.search } },
        { phone: { contains: filter.search } },
        { user: { firstName: { contains: filter.search } } },
        { user: { lastName: { contains: filter.search } } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: { include: { product: { include: { variants: true } } } }, user: true },
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { list: list.map((o) => this.mapOrderProducts(o)), total };
  }

  async updateStatus(input: UpdateOrderStatusInput) {
    const existing = await this.findById(input.orderId);
    const wasCancelled = existing.status === OrderStatus.CANCELLED;
    const willBeCancelled = input.status === OrderStatus.CANCELLED;

    // Stock only ever left the shop once the order was marked PAID (see
    // setPaymentStatus) — so cancelling/reactivating an order that was
    // never paid has nothing to give back or take again. Only a paid
    // order's cancel/reactivate transition touches inventory.
    const affectsStock = wasCancelled !== willBeCancelled && existing.paymentStatus === PaymentStatus.PAID;

    if (!affectsStock) {
      const order = await this.prisma.order.update({
        where: { id: input.orderId },
        data: { status: input.status },
        include: { items: { include: { product: { include: { variants: true } } } } },
      });
      return this.mapOrderProducts(order);
    }

    const order = await this.prisma.$transaction(async (tx) => {
      await this.adjustInventory(tx, existing.items, willBeCancelled ? 'increase' : 'decrease');
      return tx.order.update({
        where: { id: input.orderId },
        data: { status: input.status },
        include: { items: { include: { product: { include: { variants: true } } } } },
      });
    });

    return this.mapOrderProducts(order);
  }

  // Separate from `status` (fulfillment stage) on purpose: whether the buyer
  // actually paid is a different question from whether the order has been
  // packed/shipped. Since real Click/Payme isn't wired up yet, the admin
  // confirms payment manually (after checking the Telegram receipt) with
  // this toggle, independent of the status dropdown.
  //
  // Marking PAID is also the moment stock actually leaves inventory —
  // createFromCart() deliberately does not touch stock, so an order that's
  // placed but never paid doesn't lock up items real paying buyers could
  // still get. If two unpaid orders exist for the last unit of something,
  // whichever one the admin marks PAID first gets it; marking the second
  // one PAID afterward correctly fails with an out-of-stock error.
  async setPaymentStatus(orderId: string, paid: boolean) {
    const existing = await this.findById(orderId);
    const wasPaid = existing.paymentStatus === PaymentStatus.PAID;

    if (wasPaid === paid) return existing;

    const order = await this.prisma.$transaction(async (tx) => {
      await this.adjustInventory(tx, existing.items, paid ? 'decrease' : 'increase');
      return tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: paid ? PaymentStatus.PAID : PaymentStatus.PENDING },
        include: { items: { include: { product: { include: { variants: true } } } } },
      });
    });

    return this.mapOrderProducts(order);
  }

  recentOrders(limit = 8) {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { items: true, user: true },
    });
  }

  countAll() {
    return this.prisma.order.count();
  }

  countByStatus(status: OrderStatus) {
    return this.prisma.order.count({ where: { status } });
  }

  async revenue(paidOnly = true) {
    const result = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: paidOnly ? { paymentStatus: PaymentStatus.PAID } : {},
    });
    return Number(result._sum.totalAmount ?? 0);
  }

  async revenueToday() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const result = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: startOfDay } },
    });
    return Number(result._sum.totalAmount ?? 0);
  }

  // Dashboarddagi "Oylik daromad" kartasi uchun — shu oyning 1-kunidan
  // (00:00) hozirgacha, xuddi revenueToday() bilan bir xil mantiq.
  async revenueThisMonth() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await this.prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: startOfMonth } },
    });
    return Number(result._sum.totalAmount ?? 0);
  }
}
