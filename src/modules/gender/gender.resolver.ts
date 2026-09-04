import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Gender } from './models/gender.model';
import { GenderService } from './gender.service';
import { CreateGenderInput, UpdateGenderInput } from './dto/gender.input';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Resolver(() => Gender)
export class GenderResolver {
  constructor(private readonly genderService: GenderService) {}

  @Public()
  @Query(() => [Gender])
  genders() {
    return this.genderService.findAll();
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Gender)
  createGender(@Args('input') input: CreateGenderInput) {
    return this.genderService.create(input);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Gender)
  updateGender(@Args('id', { type: () => ID }) id: string, @Args('input') input: UpdateGenderInput) {
    return this.genderService.update(id, input);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Boolean)
  removeGender(@Args('id', { type: () => ID }) id: string) {
    return this.genderService.remove(id);
  }
}
