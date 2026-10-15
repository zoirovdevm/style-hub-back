import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { parseColorImagesJsonArray, parseJsonArray } from '../../common/utils/parse-json-array.util';
import { priceForVariant } from '../../common/utils/variant-price.util';
import { StockBotService } from '../stock-bot/stock-bot.service';
import { InitDataError, TelegramWebAppUser, verifyTelegramInitData } from './telegram-init-data';

// Sessiya tokenining ichidagi ma'lumot.
export interface OmborSession {
  // Telegram foydalanuvchisi (imzosi tekshirilgan initData'dan olingan).
  telegramUserId: string;
  telegramUsername: string | null;
  // Qaysi magazin nomidan ishlayapti. Barcha so'rovlar FAQAT shu
  // magazinning tovarlariga ruxsat beradi.
  storeId: string;
}

// Mini App `session`/`login` javobi.
export interface SessionResult {
  authenticated: boolean;
  token?: string;
  store?: { name: string };
  user: { id: string; firstName: string | null; username: string | null };
}

export interface DeductResult {
  productId: string;
  productTitle: string;
  variantLabel: string | null;
  deducted: number;
  remainingVariant: number | null;
  remainingProduct: number;
}

const TOKEN_AUDIENCE = 'wardrobe-ombor';
// Token muddati. Mini App har ochilganda `session` orqali yangisini oladi,
// shuning uchun uzoq bo'lishi shart emas.
const TOKEN_TTL = '12h';

// Noto'g'ri kod uchun cheklov: bitta Telegram foydalanuvchisi 15 daqiqada
// 5 martadan ko'p xato kod kirita olmaydi. Foydalanuvchi IMZOLANGAN
// initData'dan olinadi, ya'ni uni almashtirib cheklovni chetlab o'tib
// bo'lmaydi. (IP bo'yicha umumiy cheklov — global ThrottlerGuard — ham
// ishlab turadi.)
const MAX_FAILED_LOGINS = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Takroriy "olib tashlash" so'rovlarini tanish uchun natijalar keshi.
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/['’‘`ʻ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class OmborService {
  private readonly logger = new Logger(OmborService.name);
  private readonly failedLogins = new Map<string, number[]>();
  private readonly idempotency = new Map<string, { at: number; result: DeductResult }>();
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly stockBot: StockBotService,
  ) {}

  // ── Sozlamalar ─────────────────────────────────────────────────────

  private botToken(): string {
    const token = process.env.TELEGRAM_STOCK_BOT_TOKEN;
    if (!token) throw new ServiceUnavailableException('OMBOR_NOT_CONFIGURED');
    return token;
  }

  // Sessiya tokenlari uchun maxfiy kalit. Alohida OMBOR_JWT_SECRET berilgan
  // bo'lsa — o'sha; aks holda saytning JWT kalitidan HMAC orqali hosil
  // qilinadi. Natijada sayt tokeni ombor uchun, ombor tokeni esa sayt uchun
  // HECH QACHON yaroqli bo'lmaydi (kalitlar boshqa-boshqa).
  private sessionSecret(): string {
    if (process.env.OMBOR_JWT_SECRET) return process.env.OMBOR_JWT_SECRET;
    const base = process.env.JWT_ACCESS_SECRET;
    if (!base) throw new ServiceUnavailableException('OMBOR_NOT_CONFIGURED');
    return createHmac('sha256', base).update('wardrobe-ombor-session-v1').digest('hex');
  }

  private verifyInitData(initData: string) {
    try {
      return verifyTelegramInitData(initData, this.botToken());
    } catch (e) {
      if (e instanceof HttpException) throw e;
      // Sababi ichki logga yoziladi (initData'ning O'ZI emas — unda
      // foydalanuvchi ma'lumoti bor), mijozga esa umumiy javob boradi.
      const reason = e instanceof InitDataError ? e.message : 'UNKNOWN';
      this.logger.warn(`initData rad etildi: ${reason}`);
      throw new UnauthorizedException('INVALID_INIT_DATA');
    }
  }

  private displayName(user: TelegramWebAppUser) {
    return user.username ?? ([user.first_name, user.last_name].filter(Boolean).join(' ') || null);
  }

  private publicUser(user: TelegramWebAppUser) {
    return { id: String(user.id), firstName: user.first_name ?? null, username: user.username ?? null };
  }

  private async issueToken(user: TelegramWebAppUser, storeId: string): Promise<string> {
    const payload = {
      sub: String(user.id),
      store: storeId,
      un: this.displayName(user),
    };
    return this.jwt.signAsync(payload, {
      secret: this.sessionSecret(),
      expiresIn: TOKEN_TTL,
      audience: TOKEN_AUDIENCE,
    });
  }

  // Har bir himoyalangan so'rovda chaqiriladi (OmborAuthGuard). Token
  // imzosi va muddati bilan cheklanmasdan, foydalanuvchining magazinga
  // biriktirilgani BAZADA hali ham borligi ham tekshiriladi — shuning
  // uchun "Chiqish" bosilsa yoki admin bog'lanishni o'chirsa, eski token
  // darhol yaroqsiz bo'ladi.
  async verifySessionToken(token: string): Promise<OmborSession> {
    let payload: { sub?: string; store?: string; un?: string | null };
    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.sessionSecret(),
        audience: TOKEN_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('SESSION_EXPIRED');
    }
    if (!payload.sub || !payload.store) throw new UnauthorizedException('SESSION_EXPIRED');

    const link = await this.prisma.telegramStoreLink.findUnique({
      where: { telegramUserId: payload.sub },
      select: { storeId: true },
    });
    if (!link || link.storeId !== payload.store) throw new UnauthorizedException('SESSION_EXPIRED');

    return { telegramUserId: payload.sub, telegramUsername: payload.un ?? null, storeId: payload.store };
  }

  // ── Kirish ─────────────────────────────────────────────────────────

  // Mini App har ochilganda chaqiriladi. Bu Telegram foydalanuvchisi
  // avval kod kiritib magazinga biriktirilgan bo'lsa — kodni QAYTA
  // so'ramasdan sessiya beriladi (ombor botining eski xatti-harakati bilan
  // bir xil, va o'sha bog'lanishlar ham ishlayveradi).
  async session(initData: string): Promise<SessionResult> {
    const { user } = this.verifyInitData(initData);
    const link = await this.prisma.telegramStoreLink.findUnique({
      where: { telegramUserId: String(user.id) },
      include: { store: { select: { id: true, name: true } } },
    });
    if (!link) return { authenticated: false, user: this.publicUser(user) };

    return {
      authenticated: true,
      token: await this.issueToken(user, link.store.id),
      store: { name: link.store.name },
      user: this.publicUser(user),
    };
  }

  private pruneFailures(key: string, now: number) {
    const recent = (this.failedLogins.get(key) ?? []).filter((t) => now - t < FAILED_LOGIN_WINDOW_MS);
    if (recent.length) this.failedLogins.set(key, recent);
    else this.failedLogins.delete(key);
    return recent;
  }

  async login(initData: string, rawCode: string): Promise<SessionResult> {
    const { user } = this.verifyInitData(initData);
    const key = String(user.id);
    const now = Date.now();

    if (this.pruneFailures(key, now).length >= MAX_FAILED_LOGINS) {
      throw new HttpException('TOO_MANY_ATTEMPTS', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Kod katta harflarda saqlanadi (eski bot ham shunday solishtirardi);
    // bo'shliqlar olib tashlanadi — telefonda tasodifan qo'yilgan
    // bo'shliq tufayli to'g'ri kod rad etilmasligi uchun.
    const code = rawCode.replace(/\s+/g, '').toUpperCase();
    const store = code
      ? await this.prisma.store.findFirst({ where: { accessCode: code }, select: { id: true, name: true } })
      : null;

    if (!store) {
      this.failedLogins.set(key, [...this.pruneFailures(key, now), now]);
      // Kodning O'ZI logga yozilmaydi.
      this.logger.warn(`Noto'g'ri magazin kodi (telegram user ${key})`);
      throw new UnauthorizedException('INVALID_CODE');
    }

    this.failedLogins.delete(key);
    await this.prisma.telegramStoreLink.upsert({
      where: { telegramUserId: key },
      create: { telegramUserId: key, telegramUsername: this.displayName(user), storeId: store.id },
      update: { storeId: store.id, telegramUsername: this.displayName(user) },
    });

    return {
      authenticated: true,
      token: await this.issueToken(user, store.id),
      store: { name: store.name },
      user: this.publicUser(user),
    };
  }

  // Chiqish — shu Telegram foydalanuvchisining magazinga bog'lanishi
  // o'chiriladi. Natijada: (1) qo'lidagi token darhol ishlamay qoladi
  // (verifySessionToken bazani tekshiradi), (2) Mini App keyingi safar
  // ochilganda kodni qaytadan so'raydi. Ombor ma'lumotlariga (tovar,
  // qoldiq, tarix) tegilmaydi.
  async logout(session: OmborSession) {
    await this.prisma.telegramStoreLink.deleteMany({
      where: { telegramUserId: session.telegramUserId, storeId: session.storeId },
    });
    return { ok: true };
  }

  async me(session: OmborSession) {
    const store = await this.prisma.store.findUnique({
      where: { id: session.storeId },
      select: { name: true },
    });
    if (!store) throw new UnauthorizedException('SESSION_EXPIRED');
    return {
      store: { name: store.name },
      user: { id: session.telegramUserId, username: session.telegramUsername },
    };
  }

  // ── Tovarlar ───────────────────────────────────────────────────────

  // Kartochka narxi — sayt bilan AYNAN bir xil qoida: variantlari bor
  // bo'lsa eng arzoni (duxi hajmlari uchun ham to'g'ri hisoblanadi).
  private cardPrice(product: { price: number; variants: { size: string; color: string; price: number | null }[] }) {
    if (!product.variants.length) return Number(product.price);
    return Math.min(...product.variants.map((v) => priceForVariant(product as any, v as any)));
  }

  async products(session: OmborSession, query?: string, categoryId?: string) {
    const rows = await this.prisma.product.findMany({
      where: {
        storeId: session.storeId,
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: { title: 'asc' },
      take: 500,
      select: {
        id: true,
        title: true,
        titleRu: true,
        sku: true,
        price: true,
        stock: true,
        images: true,
        categoryId: true,
        category: { select: { name: true, nameRu: true } },
        variants: { select: { size: true, color: true, price: true } },
      },
    });

    // Qidiruv xotirada bajariladi: bitta magazinning tovarlari bir necha
    // yuzdan oshmaydi, SQLite'ning LIKE'i esa kirill harflarida katta-kichik
    // harfni farqlaydi — bu yerda esa farqlanmaydi.
    const q = query ? normalizeSearch(query) : '';
    const filtered = q
      ? rows.filter((p) =>
          [p.title, p.titleRu, p.sku, p.category?.name, p.category?.nameRu]
            .filter(Boolean)
            .some((field) => normalizeSearch(String(field)).includes(q)),
        )
      : rows;

    return filtered.map((p) => ({
      id: p.id,
      title: p.title,
      titleRu: p.titleRu,
      sku: p.sku,
      price: this.cardPrice(p as any),
      stock: p.stock,
      image: parseJsonArray(p.images)[0] ?? null,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      categoryNameRu: p.category?.nameRu ?? null,
    }));
  }

  async product(session: OmborSession, id: string) {
    // `storeId` sharti bilan — boshqa magazinning tovarini id'si orqali
    // ochib bo'lmaydi (topilmadi deb javob beriladi).
    const p = await this.prisma.product.findFirst({
      where: { id, storeId: session.storeId, isActive: true },
      include: {
        variants: { orderBy: [{ color: 'asc' }, { size: 'asc' }] },
        category: { select: { id: true, name: true, nameRu: true } },
      },
    });
    if (!p) throw new NotFoundException('PRODUCT_NOT_FOUND');

    return {
      id: p.id,
      title: p.title,
      titleRu: p.titleRu,
      sku: p.sku,
      price: this.cardPrice(p as any),
      basePrice: Number(p.price),
      stock: p.stock,
      images: parseJsonArray(p.images),
      colorImages: parseColorImagesJsonArray((p as any).colorImages),
      category: p.category,
      variants: p.variants.map((v) => ({
        id: v.id,
        size: v.size,
        color: v.color,
        stock: v.stock,
        price: priceForVariant(p as any, v as any),
      })),
    };
  }

  async categories(session: OmborSession) {
    const grouped = await this.prisma.product.groupBy({
      by: ['categoryId'],
      where: { storeId: session.storeId, isActive: true },
      _count: { _all: true },
    });
    if (!grouped.length) return [];
    const cats = await this.prisma.category.findMany({
      where: { id: { in: grouped.map((g) => g.categoryId) } },
      select: { id: true, name: true, nameRu: true },
    });
    const counts = new Map(grouped.map((g) => [g.categoryId, g._count._all]));
    return cats
      .map((c) => ({ ...c, productCount: counts.get(c.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // ── Ombordan ayirish ───────────────────────────────────────────────
  //
  // XAVFSIZLIK VA TO'G'RILIK KAFOLATLARI:
  //   • Faqat O'Z magazinining tovari (storeId sharti bilan).
  //   • ATOMAR: qoldiq "o'qib → hisoblab → yozish" bilan emas, bitta
  //     shartli UPDATE bilan kamaytiriladi: `stock >= soni` bo'lsagina
  //     `stock = stock - soni`. Ikki sotuvchi bir vaqtda oxirgi donani
  //     ayirmoqchi bo'lsa, faqat bittasi o'tadi, ikkinchisi "yetarli emas"
  //     deb javob oladi — qoldiq HECH QACHON manfiy bo'lmaydi.
  //   • Hammasi bitta tranzaksiyada: variant, tovarning umumiy qoldig'i
  //     (variantlar yig'indisi — sayt aynan shuni ko'rsatadi) va tarix
  //     yozuvi (StockDeduction) — yoki hammasi yoziladi, yoki hech biri.
  //   • Takroriy so'rov (bir tugma ikki marta, tarmoq qayta yuborishi):
  //     `requestId` bo'yicha taniladi va IKKINCHI marta ayirilmaydi.
  //   • Eski botdan farqi: so'ralgan son qoldiqdan ko'p bo'lsa, borini
  //     jimgina ayirib qo'ymaydi — so'rov rad etiladi.
  async deduct(
    session: OmborSession,
    input: { productId: string; variantId?: string; quantity: number; requestId: string },
  ): Promise<DeductResult> {
    const key = `${session.storeId}:${session.telegramUserId}:${input.requestId}`;
    const now = Date.now();
    for (const [k, v] of this.idempotency) if (now - v.at > IDEMPOTENCY_TTL_MS) this.idempotency.delete(k);

    const cached = this.idempotency.get(key);
    if (cached) return cached.result;
    if (this.inFlight.has(key)) throw new ConflictException('DUPLICATE_REQUEST');
    this.inFlight.add(key);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.findFirst({
          where: { id: input.productId, storeId: session.storeId, isActive: true },
          include: { variants: true },
        });
        if (!product) throw new NotFoundException('PRODUCT_NOT_FOUND');

        let remainingVariant: number | null = null;
        let remainingProduct: number;
        let size: string | null = null;
        let color: string | null = null;

        if (product.variants.length > 0) {
          if (!input.variantId) throw new BadRequestException('VARIANT_REQUIRED');
          const variant = product.variants.find((v) => v.id === input.variantId);
          if (!variant) throw new NotFoundException('VARIANT_NOT_FOUND');
          size = variant.size || null;
          color = variant.color || null;

          const updated = await tx.productVariant.updateMany({
            where: { id: variant.id, productId: product.id, stock: { gte: input.quantity } },
            data: { stock: { decrement: input.quantity } },
          });
          if (updated.count === 0) throw new ConflictException('INSUFFICIENT_STOCK');

          const fresh = await tx.productVariant.findUnique({ where: { id: variant.id }, select: { stock: true } });
          remainingVariant = fresh?.stock ?? 0;
          const sum = await tx.productVariant.aggregate({
            _sum: { stock: true },
            where: { productId: product.id },
          });
          remainingProduct = sum._sum.stock ?? 0;
          await tx.product.update({ where: { id: product.id }, data: { stock: remainingProduct } });
        } else {
          const updated = await tx.product.updateMany({
            where: { id: product.id, storeId: session.storeId, stock: { gte: input.quantity } },
            data: { stock: { decrement: input.quantity } },
          });
          if (updated.count === 0) throw new ConflictException('INSUFFICIENT_STOCK');
          const fresh = await tx.product.findUnique({ where: { id: product.id }, select: { stock: true } });
          remainingProduct = fresh?.stock ?? 0;
        }

        await tx.stockDeduction.create({
          data: {
            storeId: session.storeId,
            productId: product.id,
            size,
            color,
            quantity: input.quantity,
            telegramUserId: session.telegramUserId,
            telegramUsername: session.telegramUsername,
          },
        });

        return {
          productId: product.id,
          productTitle: product.title,
          variantLabel: [size, color].filter(Boolean).join(' / ') || null,
          deducted: input.quantity,
          remainingVariant,
          remainingProduct,
        };
      });

      this.idempotency.set(key, { at: Date.now(), result });
      void this.notifyAdmin(session, result);
      return result;
    } finally {
      this.inFlight.delete(key);
    }
  }

  // Adminga xabar — eski botdagi bilan bir xil mazmunda. Xatolik bo'lsa
  // ham ayirish natijasiga ta'sir qilmaydi.
  private async notifyAdmin(session: OmborSession, r: DeductResult) {
    try {
      const store = await this.prisma.store.findUnique({ where: { id: session.storeId }, select: { name: true } });
      const label = r.variantLabel ? `${r.productTitle} — ${r.variantLabel}` : r.productTitle;
      const who = session.telegramUsername ?? `id ${session.telegramUserId}`;
      await this.stockBot.notifyAdmin(
        `📉 Ombordan ayirildi (Mini App)\n\n🏬 Magazin: ${store?.name ?? '—'}\n📦 Tovar: ${label}\n➖ Soni: ${r.deducted} dona\n📊 Qolgan: ${r.remainingVariant ?? r.remainingProduct}\n👤 Kim: ${who}`,
      );
    } catch (e) {
      this.logger.warn(`Admin xabari yuborilmadi: ${(e as Error).message}`);
    }
  }
}
