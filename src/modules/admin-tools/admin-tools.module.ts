import { Module } from '@nestjs/common';
import { AdminToolsService } from './admin-tools.service';
import { AdminToolsResolver } from './admin-tools.resolver';

@Module({
  providers: [AdminToolsService, AdminToolsResolver],
})
export class AdminToolsModule {}
