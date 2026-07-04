import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Brand {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  logo?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
