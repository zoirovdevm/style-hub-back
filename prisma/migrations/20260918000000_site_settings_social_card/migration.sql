-- AlterTable: ijtimoiy tarmoq havolalari (footer'dagi ikonkalar) va
-- to'lov kartasi ma'lumotlari — hammasi admin panelning "Sozlamalar"
-- bo'limidan tahrirlanadi, kodda qattiq yozilgan qiymat qolmaydi.
ALTER TABLE "site_settings" ADD COLUMN "socialTelegram" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "socialInstagram" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "paymentCardNumber" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "paymentCardHolder" TEXT;
