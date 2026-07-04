import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { StatsResolver } from './stats.resolver';
import { UserModule } from '../user/user.module';
import { ProductModule } from '../product/product.module';
import { OrderModule } from '../order/order.module';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [UserModule, ProductModule, OrderModule, PresenceModule],
  providers: [StatsService, StatsResolver],
})
export class StatsModule {}
