-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "heroImage" TEXT,
    "updatedAt" DATETIME NOT NULL
);
