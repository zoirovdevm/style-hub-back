import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { Product } from '../../product/models/product.model';

@ObjectType()
export class OrderItem {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  productId: string;

  @Field(() => Product, { nullable: true })
  product?: Product;

  @Field()
  title: string;

  @Field(() => Float)
  price: number;

  @Field({ nullable: true })
  size?: string;

  @Field({ nullable: true })
  color?: string;

  @Field(() => Int)
  quantity: number;
}
