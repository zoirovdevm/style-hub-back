-- AlterTable
ALTER TABLE "orders" ADD COLUMN "telegramLang" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "resetCode" TEXT;
ALTER TABLE "users" ADD COLUMN "resetCodeExpiresAt" DATETIME;
