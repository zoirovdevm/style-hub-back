import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { Role } from '../src/common/enums/role.enum';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@fashion.local';
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      firstName: 'Admin',
      lastName: 'StyleHub',
      role: Role.ADMIN as string,
    },
  });

  // `name` is the site's default/uz-locale label (same pattern as
  // Product.title/titleRu) — it must NOT be left in English, otherwise the
  // Uzbek storefront falls back to showing the English word since there's
  // no separate uz-specific field. `slug` stays tied to the *original*
  // English identifier (via `enSlug`) so URLs/filter links don't shift if
  // this seed is re-run after the category was already renamed once.
  const categories = [
    { enSlug: 't-shirts', name: 'Futbolkalar', nameRu: 'Футболки' },
    { enSlug: 'shirts', name: "Ko'ylaklar", nameRu: 'Рубашки' },
    { enSlug: 'jeans', name: 'Jinsi shimlar', nameRu: 'Джинсы' },
    { enSlug: 'dresses', name: 'Sarafanlar', nameRu: 'Платья' },
    { enSlug: 'jackets', name: 'Kurtkalar', nameRu: 'Куртки' },
    { enSlug: 'shoes', name: 'Poyabzallar', nameRu: 'Обувь' },
    { enSlug: 'accessories', name: 'Aksessuarlar', nameRu: 'Аксессуары' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.enSlug },
      update: { name: cat.name, nameRu: cat.nameRu },
      create: {
        name: cat.name,
        nameRu: cat.nameRu,
        slug: cat.enSlug,
      },
    });
  }

  const brands = ['StyleHub Basics', 'Urban Edge', 'Nordic Line'];
  for (const brandName of brands) {
    await prisma.brand.upsert({
      where: { slug: slugify(brandName, { lower: true }) },
      update: {},
      create: { name: brandName, slug: slugify(brandName, { lower: true }) },
    });
  }

  console.log('Seed complete. Admin login:', adminEmail, '/ Admin123!');
  console.log('Admin id:', admin.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
