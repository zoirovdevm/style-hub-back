import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Telegraf, Markup } from 'telegraf';
import { launchBotWithRetry } from '../../common/utils/launch-bot-with-retry';

/**
 * "Wardrobe Ombor" Telegram boti — endi faqat Mini App'ni OCHIB BERADI.
 *
 * AVVAL: butun ish chat ichida edi — til tanlash, kod yozish, tovarni
 * inline tugmalardan tanlash, sonini yozib yuborish, tasdiqlash.
 *
 * ENDI: barcha ish Mini App'da (frontend: /ombor, backend: /ombor-api —
 * modules/ombor). Bot esa:
 *   • /start bosilganda qisqa salom va "📦 Omborga kirish" tugmasini
 *     yuboradi — tugma Mini App'ni to'g'ridan-to'g'ri ochadi;
 *   • chat pastidagi doimiy "Menu" tugmasini ham Mini App'ga bog'laydi;
 *   • adminga "ombordan ayirildi" xabarlarini yuboradi (notifyAdmin).
 *
 * OLIB TASHLANGAN eski oqimlar: til tanlash tugmalari (lang_*), chatda kod
 * so'rash, tovar/variant/son tanlash tugmalari (prod_*, var_*, qty_*),
 * tasdiqlash (confirm_*), "yana ayirish" (again), /ombor va /language
 * buyruqlari hamda chatdagi ayirish mantig'i. Eski xabarlardagi
 * tugmalarni bosgan foydalanuvchi ham shu salom + Mini App tugmasini
 * oladi — hech kim boshi berk ko'chada qolmaydi.
 *
 * Token o'zgarmadi: TELEGRAM_STOCK_BOT_TOKEN. Bo'sh bo'lsa bot ishga
 * tushmaydi, sayt ishlayveradi. Magazinga oldin kod bilan ulangan
 * foydalanuvchilarning bog'lanishi (TelegramStoreLink) saqlanadi — Mini
 * App'da ular kodni qayta kiritmaydi.
 */

type Lang = 'uz' | 'ru';

const T: Record<Lang, { welcome: string; open: string; menu: string; startDesc: string }> = {
  uz: {
    welcome:
      'Assalomu alaykum! 👋\nWardrobe Ombor tizimiga xush kelibsiz.\nOmborni boshqarish uchun quyidagi tugmani bosing.',
    open: '📦 Omborga kirish',
    menu: 'Ombor',
    startDesc: '📦 Omborga kirish',
  },
  ru: {
    welcome:
      'Здравствуйте! 👋\nДобро пожаловать в Wardrobe Ombor.\nДля управления складом нажмите кнопку ниже.',
    open: '📦 Открыть склад',
    menu: 'Склад',
    startDesc: '📦 Открыть склад',
  },
};

@Injectable()
export class StockBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StockBotService.name);
  private bot?: Telegraf;
  private botHandle: { stop: () => void } | null = null;

  // Mini App manzili. Telegram faqat HTTPS manzilni qabul qiladi.
  private webAppUrl(): string {
    return process.env.OMBOR_WEBAPP_URL || 'https://wardrobestore.uz/ombor';
  }

  private langOf(ctx: any): Lang {
    return String(ctx.from?.language_code ?? '').startsWith('ru') ? 'ru' : 'uz';
  }

  onModuleInit() {
    const token = process.env.TELEGRAM_STOCK_BOT_TOKEN;
    if (!token) {
      this.logger.warn("TELEGRAM_STOCK_BOT_TOKEN bo'sh — ombor boti ishga tushmadi (saytga ta'sir qilmaydi).");
      return;
    }

    const bot = new Telegraf(token);
    this.bot = bot;

    bot.start((ctx) => this.sendWelcome(ctx));

    // Eski chat oqimidan qolgan inline tugmalar (prod_*, qty_* va h.k.)
    // bosilsa — "soat"ni to'xtatamiz va Mini App tugmasini beramiz.
    bot.on('callback_query', async (ctx) => {
      await ctx.answerCbQuery().catch(() => undefined);
      await this.sendWelcome(ctx);
    });

    // Har qanday boshqa xabar (eski /ombor, /language, matn) — o'sha salom.
    bot.on('message', (ctx) => this.sendWelcome(ctx));

    void this.configureMenu(bot);

    this.botHandle = launchBotWithRetry(bot, this.logger, 'Ombor boti (Mini App launcher)');
  }

  onModuleDestroy() {
    this.botHandle?.stop();
    this.bot?.stop('SIGTERM');
  }

  private async sendWelcome(ctx: any) {
    const lang = this.langOf(ctx);
    try {
      await ctx.reply(T[lang].welcome, Markup.inlineKeyboard([[Markup.button.webApp(T[lang].open, this.webAppUrl())]]));
    } catch (e) {
      // Eng ko'p uchraydigan sabab — OMBOR_WEBAPP_URL https emas yoki
      // BotFather'da domen ruxsat etilmagan.
      this.logger.warn(`Mini App tugmasini yuborib bo'lmadi: ${(e as Error).message}`);
    }
  }

  // Buyruqlar ro'yxatida faqat /start qoladi; chat pastidagi "Menu"
  // tugmasi esa Mini App'ni ochadi. Xatolik botning asosiy ishiga
  // ta'sir qilmaydi — faqat logga yoziladi.
  private async configureMenu(bot: Telegraf) {
    try {
      await bot.telegram.setMyCommands([{ command: 'start', description: T.uz.startDesc }]);
      await bot.telegram.setMyCommands([{ command: 'start', description: T.uz.startDesc }], { language_code: 'uz' });
      await bot.telegram.setMyCommands([{ command: 'start', description: T.ru.startDesc }], { language_code: 'ru' });
      await bot.telegram.setChatMenuButton({
        menuButton: { type: 'web_app', text: T.uz.menu, web_app: { url: this.webAppUrl() } },
      });
    } catch (e) {
      this.logger.warn(`Bot menyusini o'rnatib bo'lmadi: ${(e as Error).message}`);
    }
  }

  // Mini App'dagi ayirishlar haqida adminga xabar (modules/ombor).
  async notifyAdmin(text: string) {
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!adminChatId || !this.bot) return;
    await this.bot.telegram.sendMessage(adminChatId, text);
  }
}
