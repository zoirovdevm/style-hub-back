import { Module } from '@nestjs/common';
import { StockBotService } from './stock-bot.service';

@Module({
  providers: [StockBotService],
  // Mini App backendi (modules/ombor) adminga xabar yuborish uchun
  // shu xizmatdan foydalanadi.
  exports: [StockBotService],
})
export class StockBotModule {}
