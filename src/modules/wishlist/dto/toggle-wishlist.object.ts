import { ObjectType, Field } from '@nestjs/graphql';
import { WishlistItem } from '../models/wishlist-item.model';

@ObjectType()
export class ToggleWishlistResult {
  @Field()
  added: boolean;

  @Field(() => WishlistItem, { nullable: true })
  item?: WishlistItem | null;
}
