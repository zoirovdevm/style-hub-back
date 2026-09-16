import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Banner } from './models/banner.model';
import { BannerService } from './banner.service';
import { CreateBannerInput, UpdateBannerInput } from './dto/banner.input';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Resolver(() => Banner)
export class BannerResolver {
  constructor(private readonly bannerService: BannerService) {}

  // Bosh sahifa shu so'rovni ishlatadi — faqat faol bannerlar.
  @Public()
  @Query(() => [Banner])
  banners() {
    return this.bannerService.findActive();
  }

  // Admin panel uchun — o'chirilganlari ham ko'rinadi.
  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Query(() => [Banner])
  adminBanners() {
    return this.bannerService.findAll();
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Banner)
  createBanner(@Args('input') input: CreateBannerInput) {
    return this.bannerService.create(input);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Banner)
  updateBanner(@Args('id', { type: () => ID }) id: string, @Args('input') input: UpdateBannerInput) {
    return this.bannerService.update(id, input);
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => Boolean)
  removeBanner(@Args('id', { type: () => ID }) id: string) {
    return this.bannerService.remove(id);
  }
}
