import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
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

  // "Buy now" (a product's "Sotib olish" button, or a card's 1-click-buy
  // modal) — orders this exact product/size/color/quantity directly,
  // WITHOUT going through the cart at all. Set alongside itemIds being
  // omitted; when buyNowProductId is present, OrderService.createFromCart
  // uses these fields instead of reading the cart table.
  //
  // Why this exists: the previous "buy now" flow called addToCart then
  // checked out with ?items=<that row's id> — but CartService.add()
  // increments an EXISTING matching cart row (same product/size/color)
  // instead of creating a second one (CartItem has a compound unique
  // constraint on userId+productId+size+color, so a second row for the
  // same combo isn't even possible), so a 1-click buy of 1 unit silently
  // became "3" whenever 2 of that exact same size/color were already
  // sitting in the cart for later — the quick purchase and the cart's
  // leftover stock quietly merged into one order.
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  buyNowProductId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  buyNowSize?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  buyNowColor?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  buyNowQuantity?: number;
}
