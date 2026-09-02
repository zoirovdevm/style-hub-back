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
    // `cartItemWhere` stays `null` for a "buy now" purchase — see below,
    // and see the deleteMany call further down that keys off it too.
    let cartItemWhere: { userId: string; id?: { in: string[] } } | null = null;
    // `any[]` (matching adjustInventory's `tx: any` above and the loose
    // style elsewhere in this file) — the two branches below produce
    // structurally-identical-enough shapes (productId/size/color/quantity
    // plus a nested `product` with variants) but come from different Prisma
    // calls (cartItem.findMany vs. product.findUnique), so a precise shared
    // type isn't worth fighting for here.
    let cartItems: any[];

    if (input.buyNowProductId) {
      // "Buy now" bypasses the cart table entirely — builds the same shape
      // the stock-check/order-creation code below expects from a single
      // direct product lookup instead of a cart query. See
      // CreateOrderInput.buyNowProductId for why this exists (it replaced
      // the old addToCart-then-checkout flow, which silently merged
      // quantities with whatever identical size/color was already in the
      // cart).
      const product = await this.prisma.product.findUnique({
        where: { id: input.buyNowProductId },
        include: { variants: true },
      });
      if (!product) throw new BadRequestException('Mahsulot topilmadi');
      cartItems = [
        {
          productId: product.id,
          size: input.buyNowSize ?? null,
          color: input.buyNowColor ?? null,
          quantity: input.buyNowQuantity ?? 1,
          product,
        },
      ];
    } else {
      // `itemIds` (from the cart page's selection checkboxes) scopes this
      // to only those rows — always ANDed with `userId` so a caller can
      // never check out someone else's cart items by passing their ids.
      // Omitted (checkout reached with nothing selected) falls back to the
      // whole cart, exactly like before `itemIds` existed.
      cartItemWhere =
        input.itemIds && input.itemIds.length > 0
          ? { userId, id: { in: input.itemIds } }
          : { userId };

      cartItems = await this.prisma.cartItem.findMany({
        where: cartItemWhere,
        include: { product: { include: { variants: true } } },
      });
    }

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
      // whole cart out from under them. `cartItemWhere` is `null` for a
      // "buy now" purchase (see above) — that path never touched the cart
      // table in the first place, so there's nothing to delete here.
      if (cartItemWhere) {
        await tx.cartItem.deleteMany({ where: cartItemWhere });
      }

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

  // ROOT-CAUSE FIX for "1 ta buyurtmani otmen qilsam, tovar 2 marta
  // qo'shilib qolyapti" (cancelling one order restocked the product
  // TWICE): updateStatus (the status dropdown's cancel/reactivate) and
  // setPaymentStatus (the paid/unpaid toggle) used to each decide
  // independently, from their OWN single field, whether stock needed to
  // move — updateStatus purely off status-just-became/stopped-being
  // CANCELLED, setPaymentStatus purely off paid-just-became/stopped-true.
  // Stock only ever actually leaves the shop once (the moment an order is
  // marked PAID) and only ever needs to come back once — but an admin
  // doing BOTH actions on the same order (cancel the status, *and* flip
  // it back to unpaid — a completely reasonable thing to do when
  // cancelling a paid order) tripped BOTH independent checks, each firing
  // its own "give the stock back" adjustment for what was really one
  // single restock event.
  //
  // This derives a single combined "is this order's stock currently OUT
  // of the warehouse" boolean from BOTH fields together — true only while
  // paid AND not cancelled — so any transition (either field, in either
  // order) compares that boolean before/after and only moves stock by the
  // ACTUAL delta. Cancel-then-unpay and unpay-then-cancel both end up
  // restocking exactly once; a single action on its own behaves exactly
  // as before (see the two call sites below).
  private stockIsOut(order: { status: string; paymentStatus: string }): boolean {
    return order.paymentStatus === PaymentStatus.PAID && order.status !== OrderStatus.CANCELLED;
  }

  async updateStatus(input: UpdateOrderStatusInput) {
    const existing = await this.findById(input.orderId);
    const wasOut = this.stockIsOut(existing);
    const willBeOut = this.stockIsOut({ status: input.status, paymentStatus: existing.paymentStatus });

    if (wasOut === willBeOut) {
      const order = await this.prisma.order.update({
        where: { id: input.orderId },
        data: { status: input.status },
        include: { items: { include: { product: { include: { variants: true } } } } },
      });
      return this.mapOrderProducts(order);
    }

    const order = await this.prisma.$transaction(async (tx) => {
      await this.adjustInventory(tx, existing.items, wasOut && !willBeOut ? 'increase' : 'decrease');
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

    // See stockIsOut's comment on updateStatus above — this now compares
    // the same combined (paid AND not-cancelled) boolean instead of
    // reacting to `paid` alone, so toggling payment on an order that's
    // ALREADY cancelled (stock already given back by updateStatus) is
    // correctly a no-op here instead of restocking a second time.
    const wasOut = this.stockIsOut(existing);
    const willBeOut = this.stockIsOut({
      status: existing.status,
      paymentStatus: paid ? PaymentStatus.PAID : PaymentStatus.PENDING,
    });

    if (wasOut === willBeOut) {
      const order = await this.prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: paid ? PaymentStatus.PAID : PaymentStatus.PENDING },
        include: { items: { include: { product: { include: { variants: true } } } } },
      });
      return this.mapOrderProducts(order);
    }

    const order = await this.prisma.$transaction(async (tx) => {
      await this.adjustInventory(tx, existing.items, wasOut && !willBeOut ? 'increase' : 'decrease');
      return tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: paid ? PaymentStatus.PAID : PaymentStatus.PENDING },
        include: { items: { include: { product: { include: { variants: true } } } } },
      });
    });

    return this.mapOrderProducts(order);
  }

  // Distinct from setPaymentStatus(orderId, false) (which just means "not
  // (yet) paid," the default state every new order starts in) — this marks
  // a receipt an admin actively looked at and turned down, so the buyer's
  // own account can show a clear red "rejected" state instead of looking
  // identical to an order nobody has reviewed yet. Reuses PaymentStatus.FAILED
  // (previously only reachable via the Click/Payme webhook path in
  // payment.service.ts, which isn't live yet since real credentials aren't
  // configured) rather than adding a new enum value.
  async rejectPayment(orderId: string) {
    const existing = await this.findById(orderId);
    if (existing.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException(
        "To'langan buyurtmani rad etib bo'lmaydi — avval \"to'lanmagan\"ga qaytaring",
      );
    }
    if (existing.paymentStatus === PaymentStatus.FAILED) return existing;

    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: PaymentStatus.FAILED },
      include: { items: { include: { product: { include: { variants: true } } } } },
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
