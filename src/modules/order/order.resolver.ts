import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
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

@Resolver(() => Order)
@UseGuards(GqlAuthGuard, RolesGuard)
export class OrderResolver {
  constructor(private readonly orderService: OrderService) {}

  @Query(() => [Order])
  myOrders(@CurrentUser() user: User) {
    return this.orderService.myOrders(user.id);
  }

  @Query(() => Order)
  order(@Args('id', { type: () => ID }) id: string) {
    return this.orderService.findById(id);
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
  setOrderPaymentStatus(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('paid', { type: () => Boolean }) paid: boolean,
  ) {
    return this.orderService.setPaymentStatus(orderId, paid);
  }
}
