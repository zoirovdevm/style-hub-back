-- CreateTable
CREATE TABLE "genders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "titleRu" TEXT,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "descriptionRu" TEXT,
    "sku" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "oldPrice" REAL,
    "discountPercent" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "sizes" TEXT NOT NULL DEFAULT '[]',
    "colors" TEXT NOT NULL DEFAULT '[]',
    "images" TEXT NOT NULL DEFAULT '[]',
    "colorImages" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "rating" REAL NOT NULL DEFAULT 0,
    "reviewsCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "categoryId" TEXT NOT NULL,
    "brandId" TEXT,
    "storeId" TEXT,
    "genderId" TEXT,
    CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_genderId_fkey" FOREIGN KEY ("genderId") REFERENCES "genders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_products" ("brandId", "categoryId", "colorImages", "colors", "createdAt", "description", "descriptionRu", "discountPercent", "id", "images", "isActive", "isFeatured", "oldPrice", "price", "rating", "reviewsCount", "sizes", "sku", "slug", "soldCount", "stock", "storeId", "title", "titleRu", "updatedAt", "viewCount") SELECT "brandId", "categoryId", "colorImages", "colors", "createdAt", "description", "descriptionRu", "discountPercent", "id", "images", "isActive", "isFeatured", "oldPrice", "price", "rating", "reviewsCount", "sizes", "sku", "slug", "soldCount", "stock", "storeId", "title", "titleRu", "updatedAt", "viewCount" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");
CREATE INDEX "products_brandId_idx" ON "products"("brandId");
CREATE INDEX "products_storeId_idx" ON "products"("storeId");
CREATE INDEX "products_genderId_idx" ON "products"("genderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "genders_name_key" ON "genders"("name");

-- CreateIndex
CREATE UNIQUE INDEX "genders_slug_key" ON "genders"("slug");
