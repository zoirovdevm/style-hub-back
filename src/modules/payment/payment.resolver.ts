import { Resolver, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentUrlResult } from './dto/payment-url.object';
import { PaymentMethod } from '../../common/enums/order.enum';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';

@Resolver()
@UseGuards(GqlAuthGuard)
export class PaymentResolver {
  constructor(private readonly paymentService: PaymentService) {}

  @Mutation(() => PaymentUrlResult)
  initiatePayment(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('method', { type: () => PaymentMethod }) method: PaymentMethod,
  ) {
    return this.paymentService.initiate(orderId, method);
  }
}
