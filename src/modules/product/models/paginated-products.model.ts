import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Product } from './product.model';

@ObjectType()
export class PaginatedProducts {
  @Field(() => [Product])
  list: Product[];

  @Field(() => Int)
  total: number;
}
