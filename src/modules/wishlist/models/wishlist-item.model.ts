import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Product } from '../../product/models/product.model';

@ObjectType()
export class WishlistItem {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  productId: string;

  @Field(() => Product, { nullable: true })
  product?: Product;

  @Field()
  createdAt: Date;
}
