import { InputType, Field, ID } from '@nestjs/graphql';
import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PaymentMethod } from '../../../common/enums/order.enum';

@InputType()
export class CreateOrderInput {
  @Field()
  @IsString()
  @MinLength(5)
  deliveryAddress: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  deliveryCity?: string;

  @Field()
  @IsString()
  phone: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  note?: string;

  // Same whitelist-stripping issue as UpdateOrderStatusInput.status: with
  // zero validator decorators this field would be silently deleted by the
  // global ValidationPipe's `whitelist: true`, so a buyer picking Click or
  // Payme at checkout would always end up saved as CASH anyway.
  @Field(() => PaymentMethod, { defaultValue: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  // Lets the cart page's new item-selection checkboxes actually mean
  // something at checkout: when set, only these cart rows (which must
  // belong to the calling user — enforced in OrderService.create, not just
  // trusted from the client) become the order, and only they get cleared
  // from the cart afterward. Omitted entirely (undefined), the whole cart
  // checks out exactly like before this field existed — every existing
  // caller (the "1-click buy" flow, checkout reached with no ?items= in
  // the URL) is unaffected.
  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  itemIds?: string[];
}
