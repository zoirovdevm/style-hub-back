import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Order } from './models/order.model';
import { PaginatedOrders } from './models/paginated-orders.model';
import { OrderService } from './order.service';
import { CreateOrderInput } from './dto/order.input';
import { OrderFilterInput } from './dto/order-filter.input';
import { UpdateOrderStatusInput } from './dto/update-order-status.input';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../user/models/user.model';
import { TelegramService } from '../telegram/telegram.service';

@Resolver(() => Order)
@UseGuards(GqlAuthGuard, RolesGuard)
export class OrderResolver {
  constructor(
    private readonly orderService: OrderService,
    private readonly telegramService: TelegramService,
  ) {}

  @Query(() => [Order])
  myOrders(@CurrentUser() user: User) {
    return this.orderService.myOrders(user.id);
  }

  // Was previously reachable by ANY logged-in buyer for ANY order id — a
  // customer who guessed or otherwise obtained another customer's order
  // UUID could read their full name/phone/address/items. Now only the
  // order's own owner or an admin can fetch it.
  @Query(() => Order)
  async order(@CurrentUser() user: User, @Args('id', { type: () => ID }) id: string) {
    const order = await this.orderService.findById(id);
    if (user.role !== Role.ADMIN && order.userId !== user.id) {
      throw new ForbiddenException('Bu buyurtma sizga tegishli emas');
    }
    return order;
  }

  @Mutation(() => Order)
  createOrder(@CurrentUser() user: User, @Args('input') input: CreateOrderInput) {
    return this.orderService.createFromCart(user.id, input);
  }

  @Roles(Role.ADMIN)
  @Query(() => PaginatedOrders)
  allOrders(@Args('filter') filter: OrderFilterInput) {
    return this.orderService.findAll(filter);
  }

  @Roles(Role.ADMIN)
  @Mutation(() => Order)
  updateOrderStatus(@Args('input') input: UpdateOrderStatusInput) {
    return this.orderService.updateStatus(input);
  }

  @Roles(Role.ADMIN)
  @Mutation(() => Order)
  async setOrderPaymentStatus(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('paid', { type: () => Boolean }) paid: boolean,
  ) {
    const order = await this.orderService.setPaymentStatus(orderId, paid);
    // The Telegram bot's own ✅/❌ buttons already notified the buyer when
    // an admin confirmed/rejected payment that way — this mutation (the
    // ADMIN WEB PANEL's paid/unpaid toggle) is the OTHER place an admin can
    // do the exact same thing, and it silently updated the database with no
    // notification at all. notifyPaymentStatus is a no-op if the bot isn't
    // configured or this buyer never opened a chat with it, so this is safe
    // to call unconditionally.
    await this.telegramService.notifyPaymentStatus(order, paid);
    return order;
  }

  // Web-panel counterpart to the Telegram bot's own ❌ "Rad etish" button —
  // both now go through OrderService.rejectPayment (PaymentStatus.FAILED),
  // and both notify the buyer the same way, so it makes no difference to
  // the buyer which channel the admin used.
  @Roles(Role.ADMIN)
  @Mutation(() => Order)
  async rejectOrderPayment(@Args('orderId', { type: () => ID }) orderId: string) {
    const order = await this.orderService.rejectPayment(orderId);
    await this.telegramService.notifyPaymentStatus(order, false);
    return order;
  }
}
