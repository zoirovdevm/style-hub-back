// Second half of the SQLite -> PostgreSQL migration. Run this AFTER:
//   1. prisma/export-data.ts has produced data-export.json (from the old
//      SQLite database)
//   2. prisma/schema.prisma's datasource provider has been switched to
//      "postgresql" and DATABASE_URL points at the new database
//   3. `npx prisma migrate dev --name init` has created fresh, empty
//      tables in that new database
//
// Usage (from the backend directory):
//   npx ts-node prisma/import-data.ts
//
// All IDs are UUID strings (not auto-increment integers), so rows are
// inserted with their ORIGINAL ids — every foreign key relationship
// (which product a review belongs to, which user placed an order, etc.)
// stays intact automatically, no remapping needed. The only thing that
// matters is INSERT ORDER: a row can't reference a foreign key that
// doesn't exist yet, so parent tables (User, Category, ...) must load
// before the tables that point at them (Review, Order, ...).
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

// JSON.stringify turns Date fields into ISO strings; this reviver turns
// them back into real Date objects so Prisma accepts them as DateTime
// values instead of rejecting/mis-storing plain strings.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
function reviveDates(_key: string, value: unknown) {
  return typeof value === 'string' && ISO_DATE.test(value) ? new Date(value) : value;
}

async function main() {
  const inPath = join(__dirname, '..', 'data-export.json');
  const data = JSON.parse(readFileSync(inPath, 'utf-8'), reviveDates);

  // Parents before children — matches the foreign-key dependencies in
  // prisma/schema.prisma. `skipDuplicates: true` makes this safe to
  // re-run (e.g. if it fails partway through and you fix something and
  // try again) without erroring on rows already imported.
  const steps: Array<[string, string, any[]]> = [
    ['users', 'user', data.users],
    ['categories', 'category', data.categories],
    ['brands', 'brand', data.brands],
    ['stores', 'store', data.stores],
    ['telegramStoreLinks', 'telegramStoreLink', data.telegramStoreLinks],
    ['products', 'product', data.products],
    ['stockDeductions', 'stockDeduction', data.stockDeductions],
    ['productVariants', 'productVariant', data.productVariants],
    ['reviews', 'review', data.reviews],
    ['cartItems', 'cartItem', data.cartItems],
    ['wishlistItems', 'wishlistItem', data.wishlistItems],
    ['orders', 'order', data.orders],
    ['orderItems', 'orderItem', data.orderItems],
    ['payments', 'payment', data.payments],
    ['siteSettings', 'siteSettings', data.siteSettings],
  ];

  for (const [label, modelKey, rows] of steps) {
    if (!rows || rows.length === 0) {
      console.log(`  ${label}: 0 (o'tkazib yuborildi)`);
      continue;
    }
    // Dynamic model access via string key — cast through `any` since the
    // model name is only known at runtime, not statically per-call.
    await (prisma as any)[modelKey].createMany({ data: rows, skipDuplicates: true });
    console.log(`  ${label}: ${rows.length} qator import qilindi`);
  }

  console.log('Import tugadi — barcha ma\'lumotlar yangi bazaga ko\'chirildi.');
}

main()
  .catch((e) => {
    console.error('Import xatolik bilan tugadi:', e);
    console.error('Xato qaysi bosqichda bo\'lganini yuqoridagi loglardan ko\'ring — o\'sha bosqichgacha bo\'lgan jadvallar allaqachon import qilingan, muammoni tuzatib qayta ishga tushirsangiz bo\'ladi (takroriy qatorlar o\'tkazib yuboriladi).');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
