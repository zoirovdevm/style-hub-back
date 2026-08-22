import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Telegraf, Markup } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';
import { launchBotWithRetry } from '../../common/utils/launch-bot-with-retry';

/**
 * Magazinchilar uchun alohida Telegram bot ("ombor boti").
 *
 * Ssenariy: biz magazinchidan tovar olib, saytga qo'yganmiz. Magazinchi o'zi
 * ham xuddi shu tovarni sotib yuborsa, botga kirib qaysi tovardan nechta
 * ketganini belgilaydi — saytdagi qoldiq shu zahoti kamayadi va adminga
 * xabar boradi.
 *
 * Oqim: /start -> til (uz/ru) -> magazin -> tovar -> (agar o'lcham/rang
 * bo'lsa: variant) -> soni -> tasdiqlash -> "Tovarlar ayirildi".
 *
 * MUHIM: bu bot uchun ALOHIDA token kerak (TELEGRAM_STOCK_BOT_TOKEN) —
 * asosiy to'lov botining tokenini bu yerga qo'ymang, ikkalasi bir vaqtda
 * bitta tokenda ishlay olmaydi (Telegram 409 xatosi beradi).
 * Token bo'sh bo'lsa bot shunchaki ishga tushmaydi, sayt ishlayveradi.
 */

type Lang = 'uz' | 'ru';

interface Session {
  lang: Lang;
  step: 'lang' | 'auth' | 'product' | 'variant' | 'qty' | 'qty_custom' | 'confirm';
  storeId?: string;
  storeName?: string;
  productId?: string;
  productTitle?: string;
  productStock?: number;
  variantId?: string;
  variantLabel?: string;
  variantStock?: number;
  qty?: number;
}

const T: Record<Lang, Record<string, string>> = {
  uz: {
    enterCode: "🔐 Magazin kodini kiriting (kodni sizga admin beradi):",
    wrongCode: "❌ Kod noto'g'ri. Qaytadan kiriting yoki admin bilan bog'laning.",
    boundOk: "✅ Kod qabul qilindi! Siz ulandingiz:",
    chooseStore: "🏬 Magazinni tanlang:",
    chooseProduct: "📦 Qaysi tovardan sotildi? Tovarni tanlang:",
    chooseVariant: "📏 Qaysi o'lcham/rang sotildi?",
    chooseQty: "🔢 Nechta sotildi? Sonni tanlang yoki yozib yuboring:",
    customQty: "✍️ Sonni yozib yuboring (masalan: 3):",
    left: "qoldiq",
    confirm: "Tasdiqlaysizmi?",
    yes: "✅ Ha, ayirish",
    no: "❌ Bekor qilish",
    done: "✅ Tovarlar ayirildi (omborda yangilandi)!",
    deducted: "Ayirildi",
    remaining: "Qolgan qoldiq",
    again: "🔄 Yana ayirish",
    cancelled: "Bekor qilindi. Boshidan boshlash uchun /start bosing.",
    noStores: "Hozircha magazinlar yo'q. Avval admin panelda magazin qo'shing.",
    noProducts: "Bu magazinda qoldig'i bor tovar topilmadi.",
    invalidQty: "Iltimos, 1 dan katta butun son yozing (masalan: 2).",
    capped: "Diqqat: omborda buncha yo'q edi, bor-yo'g'i shuncha ayirildi:",
    start: "Assalomu alaykum! 👋\nBu — Wardrobe ombor boti. Magazindan sotilgan tovarni belgilasangiz, saytdagi qoldiqdan avtomatik ayiriladi.\n\nTilni tanlang / Выберите язык:",
    piece: "dona",
  },
  ru: {
    enterCode: "🔐 Введите код магазина (код вам даёт админ):",
    wrongCode: "❌ Неверный код. Попробуйте ещё раз или свяжитесь с админом.",
    boundOk: "✅ Код принят! Вы подключены:",
    chooseStore: "🏬 Выберите магазин:",
    chooseProduct: "📦 Какой товар продан? Выберите товар:",
    chooseVariant: "📏 Какой размер/цвет продан?",
    chooseQty: "🔢 Сколько штук продано? Выберите или напишите число:",
    customQty: "✍️ Напишите число (например: 3):",
    left: "остаток",
    confirm: "Подтверждаете?",
    yes: "✅ Да, списать",
    no: "❌ Отмена",
    done: "✅ Товары списаны (склад обновлён)!",
    deducted: "Списано",
    remaining: "Текущий остаток",
    again: "🔄 Списать ещё",
    cancelled: "Отменено. Нажмите /start чтобы начать заново.",
    noStores: "Магазинов пока нет. Сначала добавьте магазин в админ-панели.",
    noProducts: "В этом магазине нет товаров с остатком.",
    invalidQty: "Пожалуйста, напишите целое число больше 0 (например: 2).",
    capped: "Внимание: на складе было меньше, списано только:",
    start: "Здравствуйте! 👋\nЭто складской бот Wardrobe. Отметьте проданный товар — остаток на сайте спишется автоматически.\n\nТилни танланг / Выберите язык:",
    piece: "шт",
  },
};

const LOW_QTY_BUTTONS = [1, 2, 3, 4, 5];

@Injectable()
export class StockBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StockBotService.name);
  private bot?: Telegraf;
  private botHandle: { stop: () => void } | null = null;
  // Oddiy in-memory sessiya: chatId -> holat. Bot qayta ishga tushsa
  // sessiyalar tozalanadi — magazinchi shunchaki /start ni qayta bosadi.
  private sessions = new Map<number, Session>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const token = process.env.TELEGRAM_STOCK_BOT_TOKEN;
    if (!token) {
      this.logger.warn(
        "TELEGRAM_STOCK_BOT_TOKEN bo'sh — ombor boti ishga tushmadi (saytga ta'sir qilmaydi). BotFather'dan YANGI bot yarating va tokenini .env ga qo'ying.",
      );
      return;
    }

    const bot = new Telegraf(token);
    this.bot = bot;

    bot.start(async (ctx) => {
      this.sessions.set(ctx.chat.id, { lang: 'uz', step: 'lang' });
      await ctx.reply(
        T.uz.start,
        Markup.inlineKeyboard([
          [Markup.button.callback("🇺🇿 O'zbekcha", 'lang_uz'), Markup.button.callback('🇷🇺 Русский', 'lang_ru')],
        ]),
      );
    });

    // XAVFSIZLIK: botda magazinlar ro'yxati UMUMAN ko'rsatilmaydi.
    // Til tanlangach: agar bu Telegram akkaunt ilgari kod kiritib
    // biriktirilgan bo'lsa — to'g'ridan-to'g'ri O'ZINING magaziniga kiradi;
    // bo'lmasa — admin bergan maxfiy kodni kiritishi so'raladi.
    bot.action(/^lang_(uz|ru)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const lang = ctx.match[1] as Lang;
      const link = await this.prisma.telegramStoreLink.findUnique({
        where: { telegramUserId: String(ctx.from!.id) },
        include: { store: true },
      });
      if (link) {
        const s: Session = {
          lang,
          step: 'product',
          storeId: link.store.id,
          storeName: link.store.name,
        };
        this.sessions.set(ctx.chat!.id, s);
        await this.showProducts(ctx, s);
      } else {
        this.sessions.set(ctx.chat!.id, { lang, step: 'auth' });
        await ctx.reply(T[lang].enterCode);
      }
    });

    bot.action(/^prod_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const s = this.session(ctx);
      if (!s?.storeId) return this.askRestart(ctx);
      const product = await this.prisma.product.findUnique({
        where: { id: ctx.match[1] },
        include: { variants: true },
      });
      if (!product) return this.askRestart(ctx);
      s.productId = product.id;
      s.productTitle = product.title;
      s.productStock = product.stock;

      const variantsInStock = product.variants.filter((v) => v.stock > 0);
      if (variantsInStock.length > 0) {
        // O'lcham/rangli tovar — aynan qaysi kombinatsiya sotilganini so'raymiz,
        // shunda saytdagi "o'lcham bo'yicha qoldiq" jadvali ham aniq qoladi.
        s.step = 'variant';
        const rows = variantsInStock.map((v) => [
          Markup.button.callback(
            `${[v.size, v.color].filter(Boolean).join(' / ')} (${v.stock})`,
            `var_${v.id}`,
          ),
        ]);
        await ctx.reply(T[s.lang].chooseVariant, Markup.inlineKeyboard(rows));
      } else {
        s.step = 'qty';
        await this.askQty(ctx, s);
      }
    });

    bot.action(/^var_(.+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const s = this.session(ctx);
      if (!s?.productId) return this.askRestart(ctx);
      const variant = await this.prisma.productVariant.findUnique({ where: { id: ctx.match[1] } });
      if (!variant) return this.askRestart(ctx);
      s.variantId = variant.id;
      s.variantLabel = [variant.size, variant.color].filter(Boolean).join(' / ');
      s.variantStock = variant.stock;
      s.step = 'qty';
      await this.askQty(ctx, s);
    });

    bot.action(/^qty_(\d+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      const s = this.session(ctx);
      if (!s?.productId) return this.askRestart(ctx);
      s.qty = parseInt(ctx.match[1], 10);
      s.step = 'confirm';
      await this.askConfirm(ctx, s);
    });

    bot.action('qty_custom', async (ctx) => {
      await ctx.answerCbQuery();
      const s = this.session(ctx);
      if (!s?.productId) return this.askRestart(ctx);
      s.step = 'qty_custom';
      await ctx.reply(T[s.lang].customQty);
    });

    bot.on('text', async (ctx) => {
      const s = this.session(ctx);
      if (!s) return;

      // Maxfiy kodni tekshirish va akkauntni magazinga biriktirish
      if (s.step === 'auth') {
        const code = ctx.message.text.trim().toUpperCase();
        const store = await this.prisma.store.findFirst({ where: { accessCode: code } });
        if (!store) {
          await ctx.reply(T[s.lang].wrongCode);
          return;
        }
        const from = ctx.from!;
        await this.prisma.telegramStoreLink.upsert({
          where: { telegramUserId: String(from.id) },
          create: {
            telegramUserId: String(from.id),
            telegramUsername: from.username ?? [from.first_name, from.last_name].filter(Boolean).join(' '),
            storeId: store.id,
          },
          update: { storeId: store.id },
        });
        s.storeId = store.id;
        s.storeName = store.name;
        s.step = 'product';
        await ctx.reply(`${T[s.lang].boundOk} 🏬 ${store.name}`);
        await this.showProducts(ctx, s);
        return;
      }

      if (s.step !== 'qty_custom') return;
      const n = parseInt(ctx.message.text.trim(), 10);
      if (!Number.isInteger(n) || n < 1) {
        await ctx.reply(T[s.lang].invalidQty);
        return;
      }
      s.qty = n;
      s.step = 'confirm';
      await this.askConfirm(ctx, s);
    });

    bot.action('confirm_yes', async (ctx) => {
      await ctx.answerCbQuery();
      const s = this.session(ctx);
      if (!s?.productId || !s.qty) return this.askRestart(ctx);
      await this.performDeduction(ctx, s);
    });

    bot.action('confirm_no', async (ctx) => {
      await ctx.answerCbQuery();
      const s = this.session(ctx);
      const lang = s?.lang ?? 'uz';
      this.sessions.delete(ctx.chat!.id);
      await ctx.reply(T[lang].cancelled);
    });

    bot.action('again', async (ctx) => {
      await ctx.answerCbQuery();
      const s = this.session(ctx);
      if (!s?.storeId) return this.askRestart(ctx);
      const next: Session = { lang: s.lang, step: 'product', storeId: s.storeId, storeName: s.storeName };
      this.sessions.set(ctx.chat!.id, next);
      await this.showProducts(ctx, next);
    });

    // getMe()/launch() can fail on a transient network hiccup (ECONNRESET,
    // ETIMEDOUT reaching api.telegram.org) — retrying automatically means the
    // bot comes back on its own once the connection recovers, instead of
    // staying dead until someone restarts the server.
    this.botHandle = launchBotWithRetry(bot, this.logger, 'Ombor boti (stock bot)');
  }

  onModuleDestroy() {
    this.botHandle?.stop();
    this.bot?.stop('SIGTERM');
  }

  private session(ctx: any): Session | undefined {
    return ctx.chat ? this.sessions.get(ctx.chat.id) : undefined;
  }

  private async askRestart(ctx: any) {
    await ctx.reply('/start');
  }

  private async showProducts(ctx: any, s: Session) {
    const products = await this.prisma.product.findMany({
      where: { storeId: s.storeId, isActive: true, stock: { gt: 0 } },
      orderBy: { title: 'asc' },
      take: 50,
      select: { id: true, title: true, stock: true },
    });
    if (products.length === 0) {
      await ctx.reply(T[s.lang].noProducts);
      return;
    }
    const rows = products.map((p) => [
      Markup.button.callback(`${p.title} (${T[s.lang].left}: ${p.stock})`, `prod_${p.id}`),
    ]);
    await ctx.reply(`🏬 ${s.storeName}\n\n${T[s.lang].chooseProduct}`, Markup.inlineKeyboard(rows));
  }

  private async askQty(ctx: any, s: Session) {
    const available = s.variantId ? s.variantStock! : s.productStock!;
    const buttons = LOW_QTY_BUTTONS.filter((n) => n <= available).map((n) =>
      Markup.button.callback(String(n), `qty_${n}`),
    );
    const rows = [buttons, [Markup.button.callback(T[s.lang].customQty.split('(')[0].trim(), 'qty_custom')]];
    const label = s.variantLabel ? `${s.productTitle} — ${s.variantLabel}` : s.productTitle;
    await ctx.reply(
      `📦 ${label}\n(${T[s.lang].left}: ${available})\n\n${T[s.lang].chooseQty}`,
      Markup.inlineKeyboard(rows),
    );
  }

  private async askConfirm(ctx: any, s: Session) {
    const label = s.variantLabel ? `${s.productTitle} — ${s.variantLabel}` : s.productTitle;
    await ctx.reply(
      `🏬 ${s.storeName}\n📦 ${label}\n🔢 ${s.qty} ${T[s.lang].piece}\n\n${T[s.lang].confirm}`,
      Markup.inlineKeyboard([
        [Markup.button.callback(T[s.lang].yes, 'confirm_yes'), Markup.button.callback(T[s.lang].no, 'confirm_no')],
      ]),
    );
  }

  private async performDeduction(ctx: any, s: Session) {
    const lang = s.lang;
    let deducted = 0;
    let remaining = 0;

    if (s.variantId) {
      // Variantli tovar: avval variantdan ayiramiz, keyin umumiy stockni
      // variantlar yig'indisidan qayta hisoblaymiz — sayt bilan sinxron.
      const variant = await this.prisma.productVariant.findUnique({ where: { id: s.variantId } });
      if (!variant) return this.askRestart(ctx);
      deducted = Math.min(s.qty!, variant.stock);
      await this.prisma.productVariant.update({
        where: { id: s.variantId },
        data: { stock: variant.stock - deducted },
      });
      const { _sum } = await this.prisma.productVariant.aggregate({
        _sum: { stock: true },
        where: { productId: s.productId },
      });
      remaining = _sum.stock ?? 0;
      await this.prisma.product.update({ where: { id: s.productId }, data: { stock: remaining } });
    } else {
      const product = await this.prisma.product.findUnique({ where: { id: s.productId } });
      if (!product) return this.askRestart(ctx);
      deducted = Math.min(s.qty!, product.stock);
      remaining = product.stock - deducted;
      await this.prisma.product.update({ where: { id: s.productId }, data: { stock: remaining } });
    }

    // Tarixga yozib qo'yamiz — admin keyin kim nimani ayirganini ko'ra oladi
    const from = ctx.from ?? {};
    await this.prisma.stockDeduction.create({
      data: {
        storeId: s.storeId!,
        productId: s.productId!,
        size: s.variantLabel?.split(' / ')[0] || null,
        color: s.variantLabel?.split(' / ')[1] || null,
        quantity: deducted,
        telegramUserId: from.id ? String(from.id) : null,
        telegramUsername: from.username ?? [from.first_name, from.last_name].filter(Boolean).join(' ') ?? null,
      },
    });

    const label = s.variantLabel ? `${s.productTitle} — ${s.variantLabel}` : s.productTitle;
    let msg = `${T[lang].done}\n\n🏬 ${s.storeName}\n📦 ${label}\n➖ ${T[lang].deducted}: ${deducted} ${T[lang].piece}\n📊 ${T[lang].remaining}: ${remaining}`;
    if (deducted < (s.qty ?? 0)) {
      msg = `${T[lang].capped} ${deducted} ${T[lang].piece}\n\n` + msg;
    }
    await ctx.reply(msg, Markup.inlineKeyboard([[Markup.button.callback(T[lang].again, 'again')]]));

    this.sessions.set(ctx.chat.id, { lang, step: 'product', storeId: s.storeId, storeName: s.storeName });

    // Adminga xabar — kim, qaysi magazindan, nimani ayirdi
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (adminChatId && this.bot) {
      const who = from.username ? `@${from.username}` : [from.first_name, from.last_name].filter(Boolean).join(' ');
      this.bot.telegram
        .sendMessage(
          adminChatId,
          `📉 Ombordan ayirildi (bot orqali)\n\n🏬 Magazin: ${s.storeName}\n📦 Tovar: ${label}\n➖ Soni: ${deducted} dona\n📊 Qolgan: ${remaining}\n👤 Kim: ${who || 'nomaʼlum'}`,
        )
        .catch((e) => this.logger.warn(`Admin xabarini yuborib bo'lmadi: ${e.message}`));
    }
  }
}
