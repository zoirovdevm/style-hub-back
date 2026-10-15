-- Promokod qamroviga yangi tur: "STORES" — kod tanlangan magazinlarning
-- hamma tovarlariga amal qiladi.
--
-- Faqat YANGI jadval qo'shiladi; mavjud jadvallar va ma'lumotlarga
-- tegilmaydi. Kod (yoki magazin) o'chirilsa, bog'lanish ham o'chadi.

CREATE TABLE "promo_code_stores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promoCodeId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    CONSTRAINT "promo_code_stores_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "promo_code_stores_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "promo_code_stores_promoCodeId_storeId_key" ON "promo_code_stores"("promoCodeId", "storeId");
CREATE INDEX "promo_code_stores_promoCodeId_idx" ON "promo_code_stores"("promoCodeId");
