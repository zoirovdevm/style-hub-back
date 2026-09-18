-- AlterTable: footer'dagi TikTok havolasi (Telegram/Instagram bilan bir
-- qatorda). Alohida migratsiya — oldingisi allaqachon serverga
-- qo'llanilgan bo'lishi mumkin, qo'llanilgan migratsiya faylini
-- o'zgartirish esa Prisma'da xatoga olib keladi ("migration modified").
ALTER TABLE "site_settings" ADD COLUMN "socialTiktok" TEXT;
