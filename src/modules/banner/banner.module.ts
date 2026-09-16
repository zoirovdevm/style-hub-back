import { Module } from '@nestjs/common';
import { BannerService } from './banner.service';
import { BannerResolver } from './banner.resolver';

@Module({
  providers: [BannerService, BannerResolver],
  exports: [BannerService],
})
export class BannerModule {}
