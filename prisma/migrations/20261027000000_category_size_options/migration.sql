-- Kategoriya uchun o'lchamlar ro'yxati (JSON matn). NULL — avtomatik
-- (hozirgi xulq-atvor), shuning uchun mavjud kategoriyalarga ta'sir yo'q.
ALTER TABLE "categories" ADD COLUMN "sizeOptions" TEXT;
