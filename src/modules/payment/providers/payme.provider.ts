import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Payme.uz (Paycom) integration (test-mode ready).
 * Docs: https://developer.help.paycom.uz/
 *
 * Flow: buildPayUrl() base64-encodes the merchant id + order params into
 * Payme's checkout URL. Payme calls back with JSON-RPC 2.0 methods which are
 * handled in payment.controller.ts.
 */
@Injectable()
export class PaymeProvider {
  constructor(private readonly config: ConfigService) {}

  buildPayUrl(orderId: string, amount: number) {
    const merchantId = this.config.get<string>('payme.merchantId');
    const testMode = this.config.get<boolean>('payme.testMode');

    if (testMode || !merchantId) {
      return `/payments/payme/test-checkout?orderId=${orderId}&amount=${amount}`;
    }

    // Payme expects amount in tiyin (1 so'm = 100 tiyin)
    const amountTiyin = Math.round(amount * 100);
    const params = `m=${merchantId};ac.order_id=${orderId};a=${amountTiyin}`;
    const encoded = Buffer.from(params).toString('base64');

    return `https://checkout.paycom.uz/${encoded}`;
  }

  verifyAuth(authHeader?: string): boolean {
    const secretKey = this.config.get<string>('payme.secretKey');
    if (this.config.get<boolean>('payme.testMode') || !secretKey) return true; // test mode bypass
    if (!authHeader?.startsWith('Basic ')) return false;

    const decoded = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString();
    const [, password] = decoded.split(':');
    return password === secretKey;
  }
}
