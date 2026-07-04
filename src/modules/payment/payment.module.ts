import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentResolver } from './payment.resolver';
import { PaymentController } from './payment.controller';
import { ClickProvider } from './providers/click.provider';
import { PaymeProvider } from './providers/payme.provider';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, PaymentResolver, ClickProvider, PaymeProvider],
  exports: [PaymentService],
})
export class PaymentModule {}
