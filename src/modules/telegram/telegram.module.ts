import { Module, forwardRef } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { TelegramService } from './telegram.service';
import { TelegramResolver } from './telegram.resolver';

// forwardRef(() => OrderModule) — see the matching comment in
// order.module.ts. `exports: [TelegramService]` is new: OrderResolver
// (in OrderModule) now injects TelegramService directly so the admin web
// panel's paid/unpaid toggle can send the buyer the same Telegram
// notification the bot's own ✅/❌ buttons already send.
@Module({
  imports: [forwardRef(() => OrderModule)],
  providers: [TelegramService, TelegramResolver],
  exports: [TelegramService],
})
export class TelegramModule {}
