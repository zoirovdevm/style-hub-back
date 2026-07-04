import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
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
}
