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
    from: process.env.MAIL_FROM ?? 'StyleHub <no-reply@stylehub.uz>',
  },
});
