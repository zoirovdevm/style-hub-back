import { Module, forwardRef } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderResolver } from './order.resolver';
import { TelegramModule } from '../telegram/telegram.module';
// Buyurtma yaratilayotganda promokod SERVERDA qayta tekshiriladi va
// chegirma qayta hisoblanadi (brauzerdan kelgan summaga ishonilmaydi).
import { PromoCodeModule } from '../promo-code/promo-code.module';

// forwardRef on both sides (see telegram.module.ts) because this is a
// genuine two-way dependency now: TelegramModule already imports OrderModule
// to call OrderService.setPaymentStatus() from the bot's own ✅/❌ buttons,
// and OrderResolver now needs TelegramService too, so it can send that same
// buyer notification when the ADMIN WEB PANEL's paid/unpaid toggle is what
// triggered the change instead of the bot.
@Module({
  imports: [forwardRef(() => TelegramModule), PromoCodeModule],
  providers: [OrderService, OrderResolver],
  exports: [OrderService],
})
export class OrderModule {}
