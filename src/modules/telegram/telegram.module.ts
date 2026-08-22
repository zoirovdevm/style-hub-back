import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { TelegramService } from './telegram.service';
import { TelegramResolver } from './telegram.resolver';

@Module({
  imports: [OrderModule],
  providers: [TelegramService, TelegramResolver],
})
export class TelegramModule {}
