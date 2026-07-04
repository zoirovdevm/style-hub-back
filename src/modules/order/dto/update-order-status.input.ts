import { InputType, Field, ID } from '@nestjs/graphql';
import { IsEnum, IsUUID } from 'class-validator';
import { OrderStatus } from '../../../common/enums/order.enum';

@InputType()
export class UpdateOrderStatusInput {
  @Field(() => ID)
  @IsUUID()
  orderId: string;

  // This field previously had NO class-validator decorator at all. The
  // global ValidationPipe uses `whitelist: true`, which silently DELETES
  // any property with zero validator decorators from the payload before
  // it reaches the resolver — so `status` was always arriving as
  // `undefined`, Prisma was silently no-op'ing the update, and the order's
  // status never actually changed no matter what the admin picked, with
  // no error anywhere to explain why. @IsEnum makes it survive whitelisting.
  @Field(() => OrderStatus)
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
