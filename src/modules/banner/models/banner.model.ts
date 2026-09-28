import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

// Bannerga biriktirilgan bitta tovar haqidagi qisqa ma'lumot.
@ObjectType()
export class BannerProductRef {
  @Field(() => ID)
  id: string;

  @Field()
  slug: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  image?: string;
}

// Bosh sahifadagi reklama banneri (Prisma `Banner` modeli).
//
// DIQQAT: bog'langan mahsulot/kategoriya bu yerda TO'LIQ obyekt sifatida
// qaytarilmaydi, faqat kerakli bir nechta maydoni (slug, nomi) tekis
// (flat) holda beriladi. Sababi: Product GraphQL modeli sizes/colors/
// images kabi maydonlarni massiv deb e'lon qiladi, bazada esa ular JSON
// matn — ularni ProductService'ning mapProduct() usuli o'giradi. Banner
// ichida xom (raw) Prisma yozuvini qaytarish o'sha o'girishni chetlab
// o'tib, GraphQL xatosiga olib kelardi. Frontendga esa havola yasash
// uchun faqat slug kerak — shuning uchun shu yetarli.
@ObjectType()
export class Banner {
  @Field(() => ID)
  id: string;

  @Field()
  image: string;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  titleRu?: string;

  // "NONE" | "PRODUCT" | "CATEGORY"
  @Field()
  linkType: string;

  @Field()
  isActive: boolean;

  @Field(() => Int)
  sortOrder: number;

  @Field({ nullable: true })
  productId?: string;

  @Field({ nullable: true })
  productSlug?: string;

  @Field({ nullable: true })
  productTitle?: string;

  @Field({ nullable: true })
  categoryId?: string;

  @Field({ nullable: true })
  categorySlug?: string;

  @Field({ nullable: true })
  categoryName?: string;

  // linkType = "PRODUCTS" bo'lganda — bannerga biriktirilgan tovarlar.
  // Faqat ko'rsatish/havola uchun kerakli maydonlar (yuqoridagi izohga
  // qarang: to'liq Product obyekti ataylab qaytarilmaydi).
  @Field(() => [BannerProductRef])
  products: BannerProductRef[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
