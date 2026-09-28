import { Module } from '@nestjs/common';
import { PromoCodeService } from './promo-code.service';
import { PromoCodeResolver } from './promo-code.resolver';

@Module({
  providers: [PromoCodeService, PromoCodeResolver],
  // OrderModule buyurtma yaratishda shu xizmatni chaqiradi (chegirmani
  // qayta hisoblash va ishlatilganini yozib qo'yish uchun).
  exports: [PromoCodeService],
})
export class PromoCodeModule {}
