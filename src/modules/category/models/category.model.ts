import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Category {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  nameRu?: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  image?: string;

  // null — avtomatik (frontend nomiga qarab tanlaydi), [] — o'lchamsiz.
  // Bazada JSON matn; ro'yxatga CategoryResolver.sizeOptions o'giradi.
  @Field(() => [String], { nullable: true })
  sizeOptions?: string[] | null;

  @Field()
  isActive: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
