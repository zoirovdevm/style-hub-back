import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SiteSettings } from './models/site-settings.model';
import { SiteSettingsService } from './site-settings.service';
import { UpdateSiteSettingsInput } from './dto/update-site-settings.input';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Resolver(() => SiteSettings)
export class SiteSettingsResolver {
  constructor(private readonly siteSettingsService: SiteSettingsService) {}

  // Public: every visitor's home page needs this to render the banner, not
  // just logged-in admins.
  @Public()
  @Query(() => SiteSettings)
  siteSettings() {
    return this.siteSettingsService.getSettings();
  }

  @UseGuards(GqlAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => SiteSettings)
  updateSiteSettings(@Args('input') input: UpdateSiteSettingsInput) {
    return this.siteSettingsService.updateSettings(input);
  }
}
