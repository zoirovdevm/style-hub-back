import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ClickProvider } from './providers/click.provider';
import { PaymeProvider } from './providers/payme.provider';

/**
 * REST endpoints Click/Payme call back on (outside GraphQL, per their spec).
 * Also exposes a tiny "test checkout" page used when real credentials
 * haven't been configured yet (CLICK_TEST_MODE / PAYME_TEST_MODE = true),
 * so the full checkout → pay → paid flow can be exercised locally.
 */
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly click: ClickProvider,
    private readonly payme: PaymeProvider,
  ) {}

  // ── Click ────────────────────────────────────────────────

  @Post('click/prepare')
  async clickPrepare(@Body() body: any) {
    const orderId = body.merchant_trans_id;
    if (!this.click.verifySignature(body, body.sign_string)) {
      return { error: -1, error_note: 'Invalid signature' };
    }
    return {
      click_trans_id: body.click_trans_id,
      merchant_trans_id: orderId,
      merchant_prepare_id: orderId,
      error: 0,
      error_note: 'Success',
    };
  }

  @Post('click/complete')
  async clickComplete(@Body() body: any) {
    const orderId = body.merchant_trans_id;
    if (!this.click.verifySignature(body, body.sign_string)) {
      return { error: -1, error_note: 'Invalid signature' };
    }

    if (Number(body.error) < 0) {
      await this.paymentService.markFailed(orderId, body);
    } else {
      await this.paymentService.markPaid(orderId, body.click_trans_id, body);
    }

    return {
      click_trans_id: body.click_trans_id,
      merchant_trans_id: orderId,
      merchant_confirm_id: orderId,
      error: 0,
      error_note: 'Success',
    };
  }

  // ── Payme (JSON-RPC 2.0) ─────────────────────────────────

  @Post('payme')
  async payme_(@Body() body: any, @Headers('authorization') authHeader?: string) {
    if (!this.payme.verifyAuth(authHeader)) {
      return { error: { code: -32504, message: 'Not authorized' }, id: body.id };
    }

    const orderId = body.params?.account?.order_id;

    switch (body.method) {
      case 'CheckPerformTransaction':
        return { result: { allow: true }, id: body.id };

      case 'CreateTransaction':
        await this.paymentService.findByOrderId(orderId); // ensures order/payment exists
        return {
          result: {
            create_time: Date.now(),
            transaction: orderId,
            state: 1,
          },
          id: body.id,
        };

      case 'PerformTransaction':
        await this.paymentService.markPaid(orderId, body.params?.id, body);
        return {
          result: {
            transaction: orderId,
            perform_time: Date.now(),
            state: 2,
          },
          id: body.id,
        };

      case 'CancelTransaction':
        await this.paymentService.markFailed(orderId, body);
        return {
          result: {
            transaction: orderId,
            cancel_time: Date.now(),
            state: -1,
          },
          id: body.id,
        };

      case 'CheckTransaction':
        return { result: { state: 2 }, id: body.id };

      default:
        return { error: { code: -32601, message: 'Method not found' }, id: body.id };
    }
  }

  // ── Local test-mode "checkout" pages ────────────────────

  @Get('click/test-checkout')
  async clickTestCheckout(@Query('orderId') orderId: string) {
    await this.paymentService.markPaid(orderId, `TEST-CLICK-${Date.now()}`);
    return { message: 'Test-mode Click payment marked as PAID', orderId };
  }

  @Get('payme/test-checkout')
  async paymeTestCheckout(@Query('orderId') orderId: string) {
    await this.paymentService.markPaid(orderId, `TEST-PAYME-${Date.now()}`);
    return { message: 'Test-mode Payme payment marked as PAID', orderId };
  }
}
