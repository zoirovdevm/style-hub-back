import { createHmac, timingSafeEqual } from 'crypto';

// TELEGRAM MINI APP `initData` NI TEKSHIRISH.
//
// Mini App ochilganda Telegram sahifaga `initData` matnini beradi: unda
// foydalanuvchi (id, ism, username), ochilgan vaqt (`auth_date`) va
// `hash` imzosi bor. Imzo BOT TOKENI bilan hisoblanadi, ya'ni uni faqat
// Telegram (va tokenni biladigan bizning server) yasay oladi. Shuning uchun
// brauzerdan kelgan "men falonchi foydalanuvchiman" degan gapga emas, faqat
// shu imzosi to'g'ri chiqqan ma'lumotga ishoniladi.
//
// Algoritm (Telegram hujjati, "Validating data received via the Mini App"):
//   secret_key = HMAC_SHA256(key = "WebAppData", data = bot_token)
//   hash       = hex(HMAC_SHA256(key = secret_key, data = data_check_string))
// data_check_string — `hash` DAN BOSHQA barcha maydonlar, kalit bo'yicha
// alifbo tartibida, "kalit=qiymat" ko'rinishida, "\n" bilan ulangan.

export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface VerifiedInitData {
  user: TelegramWebAppUser;
  authDate: number;
}

export class InitDataError extends Error {}

// Odatiy amaliyot — 24 soat. Undan eski `initData` qabul qilinmaydi:
// tashqarida qolib ketgan eski nusxa bilan qayta kirib bo'lmasligi uchun.
const DEFAULT_MAX_AGE_SEC = 24 * 60 * 60;

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSec = DEFAULT_MAX_AGE_SEC,
  nowSec = Math.floor(Date.now() / 1000),
): VerifiedInitData {
  if (!initData || typeof initData !== 'string') throw new InitDataError('EMPTY');
  if (!botToken) throw new InitDataError('NO_BOT_TOKEN');

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) throw new InitDataError('NO_HASH');
  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secretKey).update(dataCheckString).digest();
  const received = Buffer.from(hash, 'hex');
  // Vaqtga chidamli taqqoslash — imzoni belgima-belgi taxmin qilib
  // bo'lmasligi uchun.
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new InitDataError('BAD_SIGNATURE');
  }

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) throw new InitDataError('NO_AUTH_DATE');
  if (nowSec - authDate > maxAgeSec) throw new InitDataError('EXPIRED');

  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(params.get('user') ?? '');
  } catch {
    throw new InitDataError('NO_USER');
  }
  if (!user || typeof user.id !== 'number') throw new InitDataError('NO_USER');

  return { user, authDate };
}
