import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Gender {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  nameRu?: string;

  @Field()
  slug: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
