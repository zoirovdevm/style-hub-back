import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';

// Promokodga biriktirilgan kategoriya/tovar haqida qisqa ma'lumot.
// To'liq Category/Product obyekti ataylab qaytarilmaydi — Banner
// modelidagi bilan bir xil sabab: Product'ning sizes/colors/images
// maydonlari bazada JSON matn bo'lib saqlanadi va ularni ProductService
// o'giradi; xom yozuvni qaytarish GraphQL xatosiga olib kelardi.
@ObjectType()
export class PromoScopeRef {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;
}

@ObjectType()
export class PromoCode {
  @Field(() => ID)
  id: string;

  @Field()
  code: string;

  // "PERCENT" | "AMOUNT"
  @Field()
  discountType: string;

  @Field(() => Float)
  discountValue: number;

  @Field(() => Float, { nullable: true })
  maxDiscount?: number | null;

  @Field(() => Float, { nullable: true })
  minOrderAmount?: number | null;

  @Field({ nullable: true })
  startsAt?: Date | null;

  @Field({ nullable: true })
  endsAt?: Date | null;

  @Field()
  isActive: boolean;

  // "ALL" | "CATEGORIES" | "PRODUCTS"
  @Field()
  scope: string;

  @Field(() => Int)
  usedCount: number;

  @Field(() => [PromoScopeRef])
  categories: PromoScopeRef[];

  @Field(() => [PromoScopeRef])
  products: PromoScopeRef[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

// Xaridor savatda kodni tekshirganda qaytadigan javob.
//
// `valid = false` bo'lsa, `message` — sababi (xaridorga ko'rsatiladigan
// tayyor matn, o'zbekcha/ruscha). Xatolik sifatida otilmaydi: kod noto'g'ri
// bo'lishi — bu oddiy holat, dastur nosozligi emas.
@ObjectType()
export class PromoCodePreview {
  @Field()
  valid: boolean;

  @Field({ nullable: true })
  code?: string;

  @Field({ nullable: true })
  message?: string;

  // Chegirma tushadigan tovarlar summasi (qamrov bo'yicha).
  @Field(() => Float)
  eligibleAmount: number;

  @Field(() => Float)
  discount: number;

  // Chegirmadan keyingi yakuniy summa.
  @Field(() => Float)
  total: number;
}
