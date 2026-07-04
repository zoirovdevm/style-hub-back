import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CartItem } from './models/cart-item.model';
import { CartService } from './cart.service';
import { AddToCartInput, UpdateCartItemInput } from './dto/cart.input';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { User } from '../user/models/user.model';

@Resolver(() => CartItem)
@UseGuards(GqlAuthGuard)
export class CartResolver {
  constructor(private readonly cartService: CartService) {}

  @Query(() => [CartItem])
  myCart(@CurrentUser() user: User) {
    return this.cartService.myCart(user.id);
  }

  @Mutation(() => CartItem)
  addToCart(@CurrentUser() user: User, @Args('input') input: AddToCartInput) {
    return this.cartService.add(user.id, input);
  }

  @Mutation(() => CartItem)
  updateCartItem(@CurrentUser() user: User, @Args('input') input: UpdateCartItemInput) {
    return this.cartService.updateQuantity(user.id, input);
  }

  @Mutation(() => Boolean)
  removeCartItem(@CurrentUser() user: User, @Args('id', { type: () => ID }) id: string) {
    return this.cartService.remove(user.id, id);
  }

  @Mutation(() => Boolean)
  clearCart(@CurrentUser() user: User) {
    return this.cartService.clear(user.id);
  }
}
