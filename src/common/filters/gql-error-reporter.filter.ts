import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';
import { TelegramService } from '../../modules/telegram/telegram.service';

// Global filter — @Catch() argumentsiz, ya'ni butun ilova bo'ylab
// (GraphQL resolverlar HAM, PaymentController/UploadController kabi oddiy
// HTTP controllerlar HAM) throw qilingan HAR QANDAY istisnodan o'tadi.
//
// Lekin Telegram'ga faqat HAQIQIY server xatoliklari (kutilmagan bug'lar —
// TypeError, Prisma xatoligi va h.k. — yoki 500+ status kodli
// HttpException) yuboriladi. Oddiy, kutilgan foydalanuvchi xatoliklari
// (BadRequestException — "parol xato", "bu raqam band", ForbiddenException,
// NotFoundException, ThrottlerException va h.k. — odatda 4xx status)
// ATAYLAB chiqarib tashlangan: aks holda har bir noto'g'ri parol yoki
// validatsiya xatoligi ham botga kelib, adminning Telegram'ini foydasiz
// xabarlar bilan to'ldirib yuborar edi.
//
// GraphQL/HTTP javobining o'zi (frontend qanday xato ko'rishi) bu filter
// tufayli HECH QANDAY o'zgarmaydi — `catch()` xatolikni Telegram'ga yuborib,
// keyin AYNAN o'zgarishsiz qaytaradi, shuning uchun mavjud xato-formatlash
// xulq-atvori (Apollo/NestJS default) butunlay saqlanib qoladi.
@Catch()
export class GqlErrorReporterFilter implements ExceptionFilter, GqlExceptionFilter {
  private readonly logger = new Logger(GqlErrorReporterFilter.name);

  constructor(private readonly telegramService: TelegramService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    this.reportIfServerError(exception, host);
    // Asl xatolikni o'zgarishsiz qaytaradi — bu filter faqat "yon effekt"
    // (Telegram xabari) qo'shadi, javobning shaklini o'zgartirmaydi.
    return exception;
  }

  private reportIfServerError(exception: unknown, host: ArgumentsHost) {
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? (exception as HttpException).getStatus() : 500;
    if (isHttpException && status < 500) return;

    const context = this.resolveContext(host);
    const error = exception instanceof Error ? exception : new Error(String(exception));

    // Fire-and-forget — Telegram'ga yuborish sekinlashsa yoki
    // muvaffaqiyatsiz bo'lsa ham, bu asl GraphQL/HTTP javobini
    // SEKINLASHTIRMASLIGI yoki TO'XTATMASLIGI kerak.
    this.telegramService.notifyServerError(context, error).catch((sendError) => {
      this.logger.error(`Xatolik haqidagi Telegram xabari yuborilmadi: ${(sendError as Error).message}`);
    });
  }

  // Xatolik aynan QAYERDA (qaysi GraphQL field yoki HTTP route) yuz
  // berganini aniqlashga urinadi — Telegram xabarida shuni ko'rsatish
  // uchun. Ikkalasi ham mos kelmasa (kamdan-kam), umumiy "Backend" bilan
  // qoldiriladi — hech qachon xato tashlamaydi.
  private resolveContext(host: ArgumentsHost): string {
    try {
      const info = GqlArgumentsHost.create(host).getInfo<any>();
      if (info?.fieldName) {
        const parent = info.parentType?.name ?? 'GraphQL';
        return `${parent}.${info.fieldName}`;
      }
    } catch {
      // GraphQL konteksti emas — pastdagi HTTP branch'ga o'tiladi.
    }
    try {
      if (host.getType() === 'http') {
        const req: any = host.switchToHttp().getRequest();
        if (req?.method && req?.originalUrl) return `${req.method} ${req.originalUrl}`;
      }
    } catch {
      // HTTP konteksti ham emas — umumiy label bilan qoldiriladi.
    }
    return 'Backend';
  }
}
