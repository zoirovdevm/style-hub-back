import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

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
}
