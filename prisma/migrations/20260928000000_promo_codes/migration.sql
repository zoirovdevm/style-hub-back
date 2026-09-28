-- Promokodlar tizimi.
--
-- promo_codes            — kodning o'zi (chegirma turi/qiymati, muddati,
--                          qamrovi, faolligi).
-- promo_code_categories  — kod faqat tanlangan KATEGORIYALARGA amal
--                          qilsin (scope = "CATEGORIES").
-- promo_code_products    — kod faqat tanlangan TOVARLARGA amal qilsin
--                          (scope = "PRODUCTS").
-- promo_code_usages      — kim ishlatgani. UNIQUE(promoCodeId, phone) —
--                          "bitta raqam bitta marta" qoidasini aynan
--                          BAZA kafolatlaydi, ya'ni ikkita buyurtma bir
--                          vaqtda kelsa ham ikkinchisi o'tmaydi.
--
-- ON DELETE CASCADE: kod (yoki tovar/kategoriya) o'chirilsa, unga
-- tegishli bog'lanishlar ham o'z-o'zidan yo'qoladi.

CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'PERCENT',
    "discountValue" REAL NOT NULL,
    "maxDiscount" REAL,
    "minOrderAmount" REAL,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scope" TEXT NOT NULL DEFAULT 'ALL',
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");
CREATE INDEX "promo_codes_isActive_idx" ON "promo_codes"("isActive");

CREATE TABLE "promo_code_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promoCodeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    CONSTRAINT "promo_code_categories_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "promo_code_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "promo_code_categories_promoCodeId_categoryId_key" ON "promo_code_categories"("promoCodeId", "categoryId");
CREATE INDEX "promo_code_categories_promoCodeId_idx" ON "promo_code_categories"("promoCodeId");

CREATE TABLE "promo_code_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promoCodeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    CONSTRAINT "promo_code_products_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "promo_code_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "promo_code_products_promoCodeId_productId_key" ON "promo_code_products"("promoCodeId", "productId");
CREATE INDEX "promo_code_products_promoCodeId_idx" ON "promo_code_products"("promoCodeId");

CREATE TABLE "promo_code_usages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promoCodeId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "userId" TEXT,
    "orderId" TEXT,
    "discount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "promo_code_usages_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "promo_code_usages_promoCodeId_phone_key" ON "promo_code_usages"("promoCodeId", "phone");
CREATE INDEX "promo_code_usages_phone_idx" ON "promo_code_usages"("phone");

-- Buyurtmaga qo'llangan kod va chegirma summasi (nusxa sifatida).
ALTER TABLE "orders" ADD COLUMN "promoCode" TEXT;
ALTER TABLE "orders" ADD COLUMN "discountAmount" REAL;
