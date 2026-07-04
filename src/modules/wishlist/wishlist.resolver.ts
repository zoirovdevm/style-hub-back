import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { WishlistItem } from './models/wishlist-item.model';
import { ToggleWishlistResult } from './dto/toggle-wishlist.object';
import { WishlistService } from './wishlist.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { User } from '../user/models/user.model';

@Resolver(() => WishlistItem)
@UseGuards(GqlAuthGuard)
export class WishlistResolver {
  constructor(private readonly wishlistService: WishlistService) {}

  @Query(() => [WishlistItem])
  myWishlist(@CurrentUser() user: User) {
    return this.wishlistService.myWishlist(user.id);
  }

  @Mutation(() => ToggleWishlistResult)
  toggleWishlist(@CurrentUser() user: User, @Args('productId', { type: () => ID }) productId: string) {
    return this.wishlistService.toggle(user.id, productId);
  }

  @Mutation(() => Boolean)
  removeWishlistItem(@CurrentUser() user: User, @Args('id', { type: () => ID }) id: string) {
    return this.wishlistService.remove(user.id, id);
  }
}
