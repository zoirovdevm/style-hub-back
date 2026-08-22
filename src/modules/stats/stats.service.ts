import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { ProductService } from '../product/product.service';
import { OrderService } from '../order/order.service';
import { PresenceService } from '../presence/presence.service';
import { OrderStatus } from '../../common/enums/order.enum';

@Injectable()
export class StatsService {
  constructor(
    private readonly userService: UserService,
    private readonly productService: ProductService,
    private readonly orderService: OrderService,
    // Was PresenceGateway (the old WebSocket-based tracker) — replaced by
    // PresenceService, the heartbeat-based tracker it was swapped for. Same
    // getOnlineCount() shape, so this is a drop-in swap.
    private readonly presenceService: PresenceService,
  ) {}

  async getDashboard() {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      revenueTotal,
      revenueToday,
      revenueThisMonth,
      bestSellers,
      lowStockProducts,
      recentOrders,
    ] = await Promise.all([
      this.userService.countAll(),
      this.productService.countAll(),
      this.orderService.countAll(),
      this.orderService.countByStatus(OrderStatus.PENDING),
      this.orderService.countByStatus(OrderStatus.PROCESSING),
      this.orderService.countByStatus(OrderStatus.SHIPPED),
      this.orderService.countByStatus(OrderStatus.DELIVERED),
      this.orderService.countByStatus(OrderStatus.CANCELLED),
      this.orderService.revenue(true),
      this.orderService.revenueToday(),
      this.orderService.revenueThisMonth(),
      this.productService.bestSellers(5),
      this.productService.lowStock(5, 10),
      this.orderService.recentOrders(8),
    ]);

    return {
      totalUsers,
      onlineUsers: this.presenceService.getOnlineCount(),
      totalProducts,
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      revenueTotal,
      revenueToday,
      revenueThisMonth,
      bestSellers,
      lowStockProducts,
      recentOrders,
    };
  }
}
