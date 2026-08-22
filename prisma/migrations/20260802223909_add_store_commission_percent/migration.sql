-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_stores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "accessCode" TEXT,
    "commissionPercent" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_stores" ("accessCode", "createdAt", "id", "name", "slug", "updatedAt") SELECT "accessCode", "createdAt", "id", "name", "slug", "updatedAt" FROM "stores";
DROP TABLE "stores";
ALTER TABLE "new_stores" RENAME TO "stores";
CREATE UNIQUE INDEX "stores_name_key" ON "stores"("name");
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");
CREATE UNIQUE INDEX "stores_accessCode_key" ON "stores"("accessCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
