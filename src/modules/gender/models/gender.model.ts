import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Gender {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
