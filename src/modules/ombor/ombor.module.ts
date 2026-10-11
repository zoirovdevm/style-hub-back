import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OmborController } from './ombor.controller';
import { OmborService } from './ombor.service';
import { OmborAuthGuard } from './ombor-auth.guard';
import { StockBotModule } from '../stock-bot/stock-bot.module';

// Wardrobe Ombor Telegram Mini App'ning backend qismi.
//
// Yangi jadval yoki migratsiya YO'Q — hammasi mavjud modellardan:
//   Store.accessCode     — magazin kodi (admin panelda beriladi),
//   TelegramStoreLink    — Telegram foydalanuvchisi ↔ magazin bog'lanishi
//                          (eski ombor boti ham aynan shuni ishlatardi),
//   Product/ProductVariant — sayt bilan UMUMIY qoldiq,
//   StockDeduction       — kim, qachon, nimani ayirgani tarixi.
@Module({
  // Kalit har bir chaqiruvda alohida beriladi (OmborService.sessionSecret),
  // shuning uchun bu yerda sozlama shart emas.
  imports: [JwtModule.register({}), StockBotModule],
  controllers: [OmborController],
  providers: [OmborService, OmborAuthGuard],
})
export class OmborModule {}
