// One-time helper for the SQLite -> PostgreSQL migration. Run this BEFORE
// switching prisma/schema.prisma's datasource provider (i.e. while it's
// still pointed at the SQLite dev.db) to dump every row from every table
// into data-export.json. Afterwards, once the new Postgres database has
// fresh tables (via `prisma migrate dev`), run import-data.ts against it
// to restore everything — same IDs, same relations, nothing lost.
//
// Usage (from the backend directory):
//   npx ts-node prisma/export-data.ts
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  // Order doesn't matter for export (just reading), but this list must
  // stay in sync with prisma/schema.prisma's models — see import-data.ts
  // for the order that DOES matter (foreign-key dependencies on insert).
  const data = {
    users: await prisma.user.findMany(),
    categories: await prisma.category.findMany(),
    brands: await prisma.brand.findMany(),
    stores: await prisma.store.findMany(),
    telegramStoreLinks: await prisma.telegramStoreLink.findMany(),
    products: await prisma.product.findMany(),
    stockDeductions: await prisma.stockDeduction.findMany(),
    productVariants: await prisma.productVariant.findMany(),
    reviews: await prisma.review.findMany(),
    cartItems: await prisma.cartItem.findMany(),
    wishlistItems: await prisma.wishlistItem.findMany(),
    orders: await prisma.order.findMany(),
    orderItems: await prisma.orderItem.findMany(),
    payments: await prisma.payment.findMany(),
    siteSettings: await prisma.siteSettings.findMany(),
  };

  const outPath = join(__dirname, '..', 'data-export.json');
  writeFileSync(outPath, JSON.stringify(data, null, 2));

  console.log('Eksport tugadi ->', outPath);
  console.log('Har bir jadvaldan nechta qator olindi:');
  for (const [table, rows] of Object.entries(data)) {
    console.log(`  ${table}: ${(rows as unknown[]).length}`);
  }
}

main()
  .catch((e) => {
    console.error('Eksport xatolik bilan tugadi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
