import { InputType, Field } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
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
}
