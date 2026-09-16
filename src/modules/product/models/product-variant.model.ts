import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class ProductVariant {
  @Field(() => ID)
  id: string;

  @Field()
  size: string;

  @Field()
  color: string;

  @Field(() => Int)
  stock: number;

  // Shu variantning o'z narxi — duxi hajmlari uchun (50ml va 100ml
  // narxi har xil). Bo'sh (null) bo'lsa mahsulotning umumiy narxi
  // ishlatiladi, shuning uchun eski mahsulotlarga ta'sir qilmaydi.
  @Field(() => Float, { nullable: true })
  price?: number | null;
}
