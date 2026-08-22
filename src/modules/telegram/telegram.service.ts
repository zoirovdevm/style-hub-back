import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { PaymentStatus } from '../../common/enums/order.enum';
import { launchBotWithRetry } from '../../common/utils/launch-bot-with-retry';

type BotLang = 'uz' | 'ru';

// All buyer-facing bot copy, in both languages. Keyed by the language the
// buyer picked on the /start language keyboard (persisted on Order.telegramLang)
// so every later message in that order's thread comes back in the same
// language, without threading a `lang` param through every call site.
const T: Record<BotLang, {
  useWebsiteButton: string;
  orderAccepted: (order: { orderNumber: string; totalAmount: number }) => string;
  orderNotFound: string;
  receiptAccepted: string;
  paymentConfirmed: (order: { orderNumber: string }) => string;
  paymentRejected: (order: { orderNumber: string }) => string;
}> = {
  uz: {
    useWebsiteButton:
      'Salom! Buyurtma cheki yuborish uchun saytdagi "Telegram orqali yuborish" tugmasidan foydalaning.',
    orderAccepted: (order) =>
      `Buyurtma #${order.orderNumber} qabul qilindi.\n` +
      `Summa: ${Number(order.totalAmount).toLocaleString('ru-RU')} so'm.\n\n` +
      `To'lovni amalga oshirgach, chek skrinshotini shu chatga rasm qilib yuboring.`,
    orderNotFound: "Bu buyurtma topilmadi. Iltimos saytdan qaytadan urinib ko'ring.",
    receiptAccepted: "Chek qabul qilindi, admin tekshirmoqda. Tez orada javob beriladi.",
    paymentConfirmed: (order) =>
      `Buyurtma #${order.orderNumber} uchun to'lovingiz muvaffaqiyatli tasdiqlandi! ` +
      `Bizni tanlaganingiz uchun katta rahmat 🙏 Tez orada buyurtmangiz yetkazib beriladi.`,
    paymentRejected: (order) =>
      `Buyurtma #${order.orderNumber} uchun yuborgan chekingiz, afsuski, hozircha tasdiqlanmadi. ` +
      `Iltimos, to'g'ri skrinshot bilan qayta urinib ko'ring yoki saytdagi telefon raqami orqali biz bilan bog'laning.`,
  },
  ru: {
    useWebsiteButton:
      'Привет! Чтобы отправить чек по заказу, используйте кнопку "Отправить в Telegram" на сайте.',
    orderAccepted: (order) =>
      `Заказ #${order.orderNumber} принят.\n` +
      `Сумма: ${Number(order.totalAmount).toLocaleString('ru-RU')} сум.\n\n` +
      `После оплаты пришлите скриншот чека прямо в этот чат.`,
    orderNotFound: 'Этот заказ не найден. Пожалуйста, попробуйте снова с сайта.',
    receiptAccepted: 'Чек получен, админ проверяет. Ответ будет совсем скоро.',
    paymentConfirmed: (order) =>
      `Оплата по заказу #${order.orderNumber} успешно подтверждена! ` +
      `Большое спасибо, что выбрали нас 🙏 Скоро ваш заказ будет доставлен.`,
    paymentRejected: (order) =>
      `К сожалению, чек по заказу #${order.orderNumber} пока не подтверждён. ` +
      `Пожалуйста, отправьте корректный скриншот ещё раз или свяжитесь с нами по телефону, указанному на сайте.`,
  },
};

const CHOOSE_LANG_TEXT = 'Tilni tanlang / Выберите язык 👇';
// Shown for the one case where we truly don't know the buyer's language yet
// (their PENDING order can't be found at all) — kept bilingual rather than
// guessing.
const NO_PENDING_ORDER_TEXT =
  "Sizning to'lov kutilayotgan buyurtmangiz topilmadi. Avval saytdan buyurtma bering.\n\n" +
  'Ваш заказ, ожидающий оплаты, не найден. Сначала оформите заказ на сайте.';
const BOT_NOT_CONFIGURED_TEXT =
  "Bot sozlanmagan (admin chat ID yo'q). Iltimos saytdagi telefon raqami orqali bog'laning.\n\n" +
  'Бот не настроен (нет admin chat ID). Свяжитесь по телефону, указанному на сайте.';

// Screenshot-based payment confirmation, coordinated through a Telegram bot
// instead of the admin's personal account:
//   1) After placing an order, the buyer is sent to
//      https://t.me/<bot>?start=order_<id> — bot.start() below first asks
//      the buyer to pick a language, then binds their Telegram chat (and
//      chosen language) to that order.
//   2) The buyer sends a screenshot of their Click/Payme transfer receipt —
//      bot.on('photo') forwards it to the admin's chat with the order
//      number, phone, total, and product code(s) so the admin can tell
//      which of several identical orders it belongs to.
//   3) The admin taps ✅/❌ under the forwarded photo — bot.on('callback_query')
//      marks the order paid (reusing OrderService.setPaymentStatus, which
//      already handles inventory correctly) or tells the buyer the receipt
//      was rejected, in whichever language that buyer picked.
// Deliberately does NOT try to auto-match a "unique kopeck amount" to a
// bank statement — the admin checks their own Click account manually
// before tapping ✅, so that trick isn't needed here.
@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf | null = null;
  private adminChatId = '';
  private botHandle: { stop: () => void } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
  ) {}

  onModuleInit() {
    const token = this.config.get<string>('telegram.botToken');
    this.adminChatId = this.config.get<string>('telegram.adminChatId') ?? '';

    if (!token) {
      this.logger.warn(
        "Telegram bot sozlanmagan (.env dagi TELEGRAM_BOT_TOKEN bo'sh) — to'lov cheklarini bot orqali qabul qilish o'chirilgan.",
      );
      return;
    }

    this.bot = new Telegraf(token);
    this.registerHandlers(this.bot);
    // getMe()/launch() can fail on a transient network hiccup (ECONNRESET,
    // ETIMEDOUT reaching api.telegram.org) — retrying automatically means the
    // bot comes back on its own once the connection recovers, instead of
    // staying dead until someone restarts the server.
    this.botHandle = launchBotWithRetry(this.bot, this.logger, "To'lov boti");
  }

  onModuleDestroy() {
    this.botHandle?.stop();
    this.bot?.stop('app shutdown');
  }

  // Used by the public Contact/Support page form — forwards straight to the
  // same admin Telegram chat the payment-screenshot flow uses, instead of
  // email (MAIL_FROM deliverability is still fragile, and this reuses
  // infrastructure that's already working). Throws if the bot isn't
  // configured so the resolver can surface a clear error to the frontend
  // instead of silently pretending the message was sent.
  async notifyContactMessage(name: string, contact: string, message: string) {
    if (!this.bot || !this.adminChatId) {
      throw new Error("Telegram bot sozlanmagan — xabar yuborib bo'lmadi.");
    }

    await this.bot.telegram.sendMessage(
      this.adminChatId,
      `✉️ Yangi xabar (Yordam sahifasi)\nIsm: ${name}\nBog'lanish: ${contact}\n\n${message}`,
    );
  }

  private registerHandlers(bot: Telegraf) {
    bot.start(async (ctx) => {
      const payload = ctx.startPayload; // e.g. "order_abc123"
      const orderId = payload?.startsWith('order_') ? payload.slice('order_'.length) : null;

      await ctx.reply(CHOOSE_LANG_TEXT, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🇺🇿 O'zbekcha", callback_data: `lang_uz_${orderId ?? 'none'}` },
              { text: '🇷🇺 Русский', callback_data: `lang_ru_${orderId ?? 'none'}` },
            ],
          ],
        },
      });
    });

    // Cast to `any` throughout the photo/callback handlers — Telegraf's
    // TypeScript overloads for bare string update-type filters ('photo',
    // 'callback_query') don't always narrow ctx.message/ctx.callbackQuery
    // the same way across versions, and there's no way to compile-check
    // this in the current environment before the user runs `npm install`.
    bot.on('photo', async (ctx: any) => {
      const chatId = String(ctx.chat.id);
      const order = await this.prisma.order.findFirst({
        where: { telegramChatId: chatId, paymentStatus: PaymentStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { product: true } } },
      });

      if (!order) {
        await ctx.reply(NO_PENDING_ORDER_TEXT);
        return;
      }

      const lang: BotLang = order.telegramLang === 'ru' ? 'ru' : 'uz';

      if (!this.adminChatId) {
        await ctx.reply(BOT_NOT_CONFIGURED_TEXT);
        return;
      }

      const photos = ctx.message.photo as { file_id: string }[];
      const largest = photos[photos.length - 1]; // Telegram sends several resolutions — last one is the biggest.

      const productCodes = order.items
        .map((item: any) => item.product?.sku)
        .filter(Boolean)
        .join(', ');

      // Caption always goes to the admin's own chat in Uzbek — the admin's
      // language doesn't depend on which language the buyer picked.
      const caption =
        `🧾 Yangi chek — Buyurtma #${order.orderNumber}\n` +
        `Mijoz telefon: ${order.phone}\n` +
        `Summa: ${Number(order.totalAmount).toLocaleString('ru-RU')} so'm\n` +
        `Mahsulot kodi: ${productCodes || '—'}`;

      await ctx.telegram.sendPhoto(this.adminChatId, largest.file_id, {
        caption,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Tasdiqlash', callback_data: `approve_${order.id}` },
              { text: '❌ Rad etish', callback_data: `reject_${order.id}` },
            ],
          ],
        },
      });

      await ctx.reply(T[lang].receiptAccepted);
    });

    bot.on('callback_query', async (ctx: any) => {
      const data = ctx.callbackQuery?.data as string | undefined;
      if (!data) return;

      // Language pick — open to anyone (not admin-gated), handled before the
      // admin-only approve/reject branch below.
      if (data.startsWith('lang_')) {
        const rest = data.slice('lang_'.length); // "uz_<orderId>" or "ru_none"
        const separatorIdx = rest.indexOf('_');
        const lang: BotLang = rest.slice(0, separatorIdx) === 'ru' ? 'ru' : 'uz';
        const orderIdOrNone = rest.slice(separatorIdx + 1);

        await ctx.answerCbQuery();

        if (orderIdOrNone === 'none') {
          await ctx.reply(T[lang].useWebsiteButton);
          return;
        }

        try {
          const order = await this.orderService.findById(orderIdOrNone);
          await this.prisma.order.update({
            where: { id: orderIdOrNone },
            data: { telegramChatId: String(ctx.chat.id), telegramLang: lang },
          });
          await ctx.reply(T[lang].orderAccepted(order));
        } catch {
          await ctx.reply(T[lang].orderNotFound);
        }
        return;
      }

      const fromId = String(ctx.callbackQuery.from.id);
      if (fromId !== this.adminChatId) {
        await ctx.answerCbQuery('Bu tugma faqat admin uchun.');
        return;
      }

      const separatorIndex = data.indexOf('_');
      const action = data.slice(0, separatorIndex);
      const orderId = data.slice(separatorIndex + 1);
      const existingCaption = ctx.callbackQuery.message?.caption ?? '';

      try {
        const order = await this.orderService.findById(orderId);
        const lang: BotLang = (order as any).telegramLang === 'ru' ? 'ru' : 'uz';

        if (action === 'approve') {
          await this.orderService.setPaymentStatus(orderId, true);
          await ctx.answerCbQuery('Tasdiqlandi ✅');
          await ctx.editMessageCaption(`${existingCaption}\n\n✅ TASDIQLANDI`);
          if (order.telegramChatId) {
            await ctx.telegram.sendMessage(order.telegramChatId, T[lang].paymentConfirmed(order));
          }
        } else {
          await ctx.answerCbQuery('Rad etildi');
          await ctx.editMessageCaption(`${existingCaption}\n\n❌ RAD ETILDI`);
          if (order.telegramChatId) {
            await ctx.telegram.sendMessage(order.telegramChatId, T[lang].paymentRejected(order));
          }
        }
      } catch (error) {
        this.logger.error(`Callback xatolik: ${(error as Error).message}`);
        await ctx.answerCbQuery('Xatolik yuz berdi');
      }
    });
  }
}
