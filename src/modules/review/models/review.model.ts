import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { User } from '../../user/models/user.model';

@ObjectType()
export class Review {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  productId: string;

  @Field(() => ID)
  userId: string;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => Int)
  rating: number;

  @Field()
  comment: string;

  // e.g. "/uploads/reviews/xxx.jpg" — a photo the buyer attached, served the
  // same way product images are (see main.ts's useStaticAssets).
  @Field({ nullable: true })
  image?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
