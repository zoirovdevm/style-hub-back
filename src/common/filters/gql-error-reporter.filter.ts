import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';
import { TelegramService } from '../../modules/telegram/telegram.service';

// Global filter — @Catch() argumentsiz, ya'ni butun ilova bo'ylab
// (GraphQL resolverlar HAM, PaymentController/UploadController kabi oddiy
// HTTP controllerlar HAM) throw qilingan HAR QANDAY istisnodan o'tadi.
//
// Telegram'ga HAMMASI yuboriladi — 404 "topilmadi" (NotFoundException,
// yoki mavjud bo'lmagan URL'ga so'rov), boshqa 4xx (400 validatsiya,
// 401/403, 429 throttling), 500+ va kutilmagan bug'lar (TypeError, Prisma
// xatoligi va h.k.). So'rov bo'yicha shunday: 404 ham ko'rinishi kerak.
// Spamdan himoya — TelegramService.notifyServerError ichidagi cooldown:
// bir xil (joy + kod + matn) xatolik 5 daqiqada faqat BIR marta yuboriladi,
// shuning uchun masalan bitta buzilgan rasm URL'iga 500 marta so'rov kelsa
// ham chatga 1 ta xabar tushadi. Xabar boshidagi belgi kodga qarab farq
// qiladi (🔴 500+, 🟡 4xx) — chatda bir qarashda ajralib turadi.
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
    this.report(exception, host);
    // Asl xatolikni o'zgarishsiz qaytaradi — bu filter faqat "yon effekt"
    // (Telegram xabari) qo'shadi, javobning shaklini o'zgartirmaydi.
    return exception;
  }

  private report(exception: unknown, host: ArgumentsHost) {
    // HttpException bo'lsa uning haqiqiy kodi (404, 400, 429...), aks holda
    // — kutilmagan bug — 500 deb hisoblanadi.
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const context = this.resolveContext(host);
    const error = exception instanceof Error ? exception : new Error(String(exception));

    // Fire-and-forget — Telegram'ga yuborish sekinlashsa yoki
    // muvaffaqiyatsiz bo'lsa ham, bu asl GraphQL/HTTP javobini
    // SEKINLASHTIRMASLIGI yoki TO'XTATMASLIGI kerak.
    this.telegramService.notifyServerError(context, error, status).catch((sendError) => {
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
