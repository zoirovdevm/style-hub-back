import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Review } from './models/review.model';
import { CreateReviewInput } from './dto/create-review.input';
import { ReviewService } from './review.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../user/models/user.model';

@Resolver(() => Review)
export class ReviewResolver {
  constructor(private readonly reviewService: ReviewService) {}

  // Public: anyone viewing a product page sees its reviews, logged in or not.
  @Public()
  @Query(() => [Review])
  reviews(@Args('productId', { type: () => ID }) productId: string) {
    return this.reviewService.findByProduct(productId);
  }

  // Lets the frontend decide up front whether to show the "write a review"
  // form or a "you must purchase this first" message, without guessing.
  // Requires login (the frontend only calls this when a user is signed in
  // and just treats a logged-out visitor as ineligible).
  @UseGuards(GqlAuthGuard)
  @Query(() => Boolean)
  canReviewProduct(@CurrentUser() user: User, @Args('productId', { type: () => ID }) productId: string) {
    return this.reviewService.canUserReview(user.id, productId, user.role);
  }

  // Only a real buyer of THIS product (a non-cancelled order containing it)
  // or an admin can leave a review — enforced in ReviewService.create, not
  // just hidden in the UI, so it can't be bypassed by calling the mutation
  // directly.
  @UseGuards(GqlAuthGuard)
  @Mutation(() => Review)
  createReview(@CurrentUser() user: User, @Args('input') input: CreateReviewInput) {
    return this.reviewService.create(user.id, user.role, input);
  }

  // Basic moderation — lets an admin remove a spammy/inappropriate review.
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Boolean)
  deleteReview(@Args('id', { type: () => ID }) id: string) {
    return this.reviewService.delete(id);
  }
}
