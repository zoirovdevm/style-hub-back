import { InputType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { OrderStatus, PaymentStatus } from '../../../common/enums/order.enum';

@InputType()
export class OrderFilterInput {
  @Field(() => OrderStatus, { nullable: true })
  @IsOptional()
  status?: OrderStatus;

  @Field(() => PaymentStatus, { nullable: true })
  @IsOptional()
  paymentStatus?: PaymentStatus;

  // Lets the admin find the exact order a Telegram payment receipt belongs
  // to — matches against order number, buyer phone, and buyer name. Without
  // this, telling apart three same-product orders in the list meant
  // scrolling/guessing.
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  page: number;

  @Field(() => Int, { defaultValue: 20 })
  @IsInt()
  @Min(1)
  limit: number;
}
