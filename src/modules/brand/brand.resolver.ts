import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Brand } from './models/brand.model';
import { BrandService } from './brand.service';
import { CreateBrandInput, UpdateBrandInput } from './dto/brand.input';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Resolver(() => Brand)
export class BrandResolver {
  constructor(private readonly brandService: BrandService) {}

  @Public()
  @Query(() => [Brand])
  brands() {
    return this.brandService.findAll();
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Brand)
  createBrand(@Args('input') input: CreateBrandInput) {
    return this.brandService.create(input);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Brand)
  updateBrand(@Args('id', { type: () => ID }) id: string, @Args('input') input: UpdateBrandInput) {
    return this.brandService.update(id, input);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Boolean)
  removeBrand(@Args('id', { type: () => ID }) id: string) {
    return this.brandService.remove(id);
  }
}
