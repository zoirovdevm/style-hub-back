import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClickProvider } from './providers/click.provider';
import { PaymeProvider } from './providers/payme.provider';
import { PaymentMethod, PaymentStatus } from '../../common/enums/order.enum';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly click: ClickProvider,
    private readonly payme: PaymeProvider,
  ) {}

  async initiate(orderId: string, method: PaymentMethod) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Order already paid');
    }

    const amount = Number(order.totalAmount);

    let payUrl: string;
    switch (method) {
      case PaymentMethod.CLICK:
        payUrl = this.click.buildPayUrl(order.id, amount);
        break;
      case PaymentMethod.PAYME:
        payUrl = this.payme.buildPayUrl(order.id, amount);
        break;
      default:
        throw new BadRequestException('Unsupported payment method for online checkout');
    }

    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      update: { provider: method, amount, status: PaymentStatus.PENDING },
      create: { orderId: order.id, provider: method, amount, status: PaymentStatus.PENDING },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { paymentMethod: method },
    });

    return { payUrl };
  }

  async markPaid(orderId: string, transactionId?: string, rawPayload?: any) {
    await this.prisma.payment.update({
      where: { orderId },
      data: {
        status: PaymentStatus.PAID,
        transactionId,
        // rawPayload is stored as a JSON-encoded string (SQLite has no Json type)
        rawPayload: rawPayload !== undefined ? JSON.stringify(rawPayload) : undefined,
      },
    });
    return this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: PaymentStatus.PAID },
    });
  }

  async markFailed(orderId: string, rawPayload?: any) {
    await this.prisma.payment.update({
      where: { orderId },
      data: {
        status: PaymentStatus.FAILED,
        rawPayload: rawPayload !== undefined ? JSON.stringify(rawPayload) : undefined,
      },
    });
    return this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: PaymentStatus.FAILED },
    });
  }

  findByOrderId(orderId: string) {
    return this.prisma.payment.findUnique({ where: { orderId } });
  }
}
