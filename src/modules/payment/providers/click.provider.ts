import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Click.uz integration (test-mode ready).
 * Docs: https://docs.click.uz/
 *
 * Flow: buildPayUrl() sends the buyer to Click's checkout page.
 * Click calls back to /payments/click/prepare then /payments/click/complete.
 */
@Injectable()
export class ClickProvider {
  constructor(private readonly config: ConfigService) {}

  buildPayUrl(orderId: string, amount: number) {
    const serviceId = this.config.get<string>('click.serviceId');
    const merchantId = this.config.get<string>('click.merchantId');
    const testMode = this.config.get<boolean>('click.testMode');

    if (testMode || !serviceId) {
      // No real Click credentials configured yet — return a local test-mode URL
      // so the checkout flow can be wired up and exercised end-to-end.
      return `/payments/click/test-checkout?orderId=${orderId}&amount=${amount}`;
    }

    const params = new URLSearchParams({
      service_id: serviceId,
      merchant_id: merchantId ?? '',
      amount: amount.toFixed(2),
      transaction_param: orderId,
      return_url: `${this.config.get<string>('corsOrigin')}/orders`,
    });

    return `https://my.click.uz/services/pay?${params.toString()}`;
  }

  verifySignature(payload: Record<string, string>, receivedSignHash: string): boolean {
    const secretKey = this.config.get<string>('click.secretKey');
    if (this.config.get<boolean>('click.testMode') || !secretKey) return true; // test mode bypass

    const {
      click_trans_id,
      service_id,
      merchant_trans_id,
      amount,
      action,
      sign_time,
      merchant_prepare_id,
    } = payload as any;

    const raw = [
      click_trans_id,
      service_id,
      secretKey,
      merchant_trans_id,
      merchant_prepare_id ?? '',
      amount,
      action,
      sign_time,
    ].join('');

    const expected = crypto.createHash('md5').update(raw).digest('hex');
    return expected === receivedSignHash;
  }
}
