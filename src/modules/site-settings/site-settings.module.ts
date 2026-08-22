import { Module } from '@nestjs/common';
import { SiteSettingsService } from './site-settings.service';
import { SiteSettingsResolver } from './site-settings.resolver';

@Module({
  providers: [SiteSettingsService, SiteSettingsResolver],
  exports: [SiteSettingsService],
})
export class SiteSettingsModule {}
