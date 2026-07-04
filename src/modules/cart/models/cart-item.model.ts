import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Product } from '../../product/models/product.model';

@ObjectType()
export class CartItem {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  productId: string;

  @Field(() => Product, { nullable: true })
  product?: Product;

  @Field({ nullable: true })
  size?: string;

  @Field({ nullable: true })
  color?: string;

  @Field(() => Int)
  quantity: number;

  @Field()
  createdAt: Date;
}
