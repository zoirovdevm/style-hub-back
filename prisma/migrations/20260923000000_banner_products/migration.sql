-- CreateTable: bitta bannerga bir NECHTA mahsulotni bog'lash uchun
-- oraliq jadval. Avval banner faqat BITTA mahsulotga (yoki bitta
-- kategoriyaga) bog'lanardi.
--
-- ON DELETE CASCADE: tovar yoki banner o'chirilsa, bu bog'lanish ham
-- o'z-o'zidan yo'qoladi — "yetim" satr qolmaydi.
CREATE TABLE "banner_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bannerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "banner_products_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "banners" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "banner_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Bir xil tovar bitta bannerga ikki marta qo'shilmasligi uchun.
CREATE UNIQUE INDEX "banner_products_bannerId_productId_key" ON "banner_products"("bannerId", "productId");
CREATE INDEX "banner_products_bannerId_idx" ON "banner_products"("bannerId");
CREATE INDEX "banner_products_productId_idx" ON "banner_products"("productId");
