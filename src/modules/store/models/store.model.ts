import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType()
export class Store {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  // Admin shu magazinchi bilan ishlaydigan komissiya foizi.
  @Field(() => Float)
  commissionPercent: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
