/*
  Warnings:

  - A unique constraint covering the columns `[accessCode]` on the table `stores` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "stores" ADD COLUMN "accessCode" TEXT;

-- CreateTable
CREATE TABLE "telegram_store_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramUserId" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "storeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_store_links_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_store_links_telegramUserId_key" ON "telegram_store_links"("telegramUserId");

-- CreateIndex
CREATE INDEX "telegram_store_links_storeId_idx" ON "telegram_store_links"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "stores_accessCode_key" ON "stores"("accessCode");
