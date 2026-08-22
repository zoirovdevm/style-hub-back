import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { Product } from '../../product/models/product.model';
import { Order } from '../../order/models/order.model';

@ObjectType()
export class DashboardStats {
  @Field(() => Int)
  totalUsers: number;

  @Field(() => Int)
  onlineUsers: number;

  @Field(() => Int)
  totalProducts: number;

  @Field(() => Int)
  totalOrders: number;

  @Field(() => Int)
  pendingOrders: number;

  @Field(() => Int)
  processingOrders: number;

  @Field(() => Int)
  shippedOrders: number;

  @Field(() => Int)
  deliveredOrders: number;

  @Field(() => Int)
  cancelledOrders: number;

  @Field(() => Float)
  revenueTotal: number;

  @Field(() => Float)
  revenueToday: number;

  @Field(() => Float)
  revenueThisMonth: number;

  @Field(() => [Product])
  bestSellers: Product[];

  @Field(() => [Product])
  lowStockProducts: Product[];

  @Field(() => [Order])
  recentOrders: Order[];
}
