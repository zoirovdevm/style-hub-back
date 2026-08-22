import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { User } from './models/user.model';
import { PaginatedUsers } from './models/paginated-users.model';
import { UserService } from './user.service';
import { UpdateProfileInput } from './dto/update-profile.input';
import { UsersFilterInput } from './dto/users-filter.input';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Resolver(() => User)
@UseGuards(GqlAuthGuard, RolesGuard)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => User)
  me(@CurrentUser() user: User) {
    return this.userService.findById(user.id);
  }

  @Mutation(() => User)
  updateProfile(@CurrentUser() user: User, @Args('input') input: UpdateProfileInput) {
    return this.userService.updateProfile(user.id, input);
  }

  @Query(() => PaginatedUsers)
  @Roles(Role.ADMIN)
  users(@Args('filter') filter: UsersFilterInput) {
    return this.userService.findAll(filter);
  }

  @Mutation(() => User)
  @Roles(Role.ADMIN)
  setUserActive(
    @CurrentUser() currentUser: User,
    @Args('id', { type: () => ID }) id: string,
    @Args('isActive') isActive: boolean,
  ) {
    // Without this, an admin could block their own account (nothing left
    // to sign in and undo it with) — the toggle in the Users table blocks
    // itself in the UI too, but the backend is the actual line of defense.
    if (id === currentUser.id) {
      throw new BadRequestException("O'zingizni bloklay olmaysiz");
    }
    return this.userService.setActive(id, isActive);
  }
}
