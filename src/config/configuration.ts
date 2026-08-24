export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  click: {
    serviceId: process.env.CLICK_SERVICE_ID ?? '',
    merchantId: process.env.CLICK_MERCHANT_ID ?? '',
    secretKey: process.env.CLICK_SECRET_KEY ?? '',
    testMode: (process.env.CLICK_TEST_MODE ?? 'true') === 'true',
  },
  payme: {
    merchantId: process.env.PAYME_MERCHANT_ID ?? '',
    secretKey: process.env.PAYME_SECRET_KEY ?? '',
    testMode: (process.env.PAYME_TEST_MODE ?? 'true') === 'true',
  },
  mail: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    // Defaults to the actual authenticated Gmail address if MAIL_FROM isn't
    // set — a "From" domain that doesn't match the authenticated SMTP
    // account has no SPF/DKIM/DMARC alignment, which is one of the
    // strongest spam signals there is.
    //
    // To send as no-reply@wardrobestore.uz instead (recommended once the
    // domain's DNS records are set up via a transactional provider like
    // Resend or Brevo — see project notes): set SMTP_HOST/SMTP_USER/SMTP_PASS
    // to that provider's SMTP relay credentials and set MAIL_FROM to
    // "Wardrobe <no-reply@wardrobestore.uz>". No code change needed — this
    // service already speaks plain SMTP via nodemailer.
    from: process.env.MAIL_FROM ?? `Wardrobe <${process.env.SMTP_USER ?? ''}>`,
  },
  sms: {
    // "SMS Gateway for Android" (sms-gate.app) — sends SMS through your
    // own phone's own SIM/number, tried first (before Eskiz/Twilio below)
    // when all three of these are set. gatewayBaseUrl is the phone's
    // Local Server address shown in the app, e.g. "http://192.168.1.50:8080"
    // (phone and backend must be on the same local network); username/
    // password are the Basic Auth credentials the app shows next to it.
    gatewayBaseUrl: process.env.SMS_GATEWAY_BASE_URL ?? '',
    gatewayUsername: process.env.SMS_GATEWAY_USERNAME ?? '',
    gatewayPassword: process.env.SMS_GATEWAY_PASSWORD ?? '',
    // Eskiz.uz (https://eskiz.uz) — the standard local SMS gateway for
    // Uzbek numbers, used only if the gateway above isn't configured.
    // Auth is email+password (not a public/private keypair) traded for a
    // Bearer token at POST /auth/login; SmsService caches that token in
    // memory and re-logs-in if a send comes back unauthorized.
    eskizEmail: process.env.ESKIZ_EMAIL ?? '',
    eskizPassword: process.env.ESKIZ_PASSWORD ?? '',
    // Sender nickname shown as the SMS's "from" — Eskiz's shared/test
    // nickname "4546" works before your own nickname is approved.
    eskizFrom: process.env.ESKIZ_FROM ?? '4546',
    // Twilio — kept as a fallback provider if Eskiz isn't configured (e.g.
    // TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM are set instead).
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    from: process.env.TWILIO_FROM ?? '',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID ?? '',
    botUsername: process.env.TELEGRAM_BOT_USERNAME ?? '',
    // Alohida bot — faqat "Yordam" (Contact) sahifasidan yuborilgan
    // xabarlar shu bot orqali adminga boradi, to'lov/buyurtma botidan
    // (TELEGRAM_BOT_TOKEN) ajratilgan holda. Bo'sh qoldirilsa, eski
    // xatti-harakat davom etadi — xabarlar to'lov botiga boradi.
    supportBotToken: process.env.TELEGRAM_SUPPORT_BOT_TOKEN ?? '',
  },
});
