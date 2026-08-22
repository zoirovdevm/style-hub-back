import { Module } from '@nestjs/common';
import { StockBotService } from './stock-bot.service';

@Module({
  providers: [StockBotService],
})
export class StockBotModule {}
