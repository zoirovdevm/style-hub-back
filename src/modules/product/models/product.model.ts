import { ObjectType, Field, ID, Int, Float } from '@nestjs/graphql';
import { Category } from '../../category/models/category.model';
import { Brand } from '../../brand/models/brand.model';
import { Store } from '../../store/models/store.model';
import { ProductVariant } from './product-variant.model';
import { ColorImages } from './color-images.model';

@ObjectType()
export class Product {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  titleRu?: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  descriptionRu?: string;

  @Field()
  sku: string;

  @Field(() => Float)
  price: number;

  @Field(() => Float, { nullable: true })
  oldPrice?: number;

  @Field(() => Int, { nullable: true })
  discountPercent?: number;

  @Field(() => Int)
  stock: number;

  @Field(() => [String])
  sizes: string[];

  @Field(() => [String])
  colors: string[];

  @Field(() => [String])
  images: string[];

  // Rang bo'yicha alohida rasmlar — masalan xaridor "ko'k" rangni tanlasa,
  // shu rangga admin yuklagan rasmlar ko'rsatiladi. Bo'sh (yoki shu rang
  // uchun yozuv yo'q) bo'lsa, tepadagi umumiy `images` ishlatiladi.
  @Field(() => [ColorImages])
  colorImages: ColorImages[];

  // Stock tracked per size+color combination — lets the storefront disable
  // a specific size/color when that exact combo is out of stock, instead
  // of only knowing the overall total in `stock`.
  @Field(() => [ProductVariant])
  variants: ProductVariant[];

  @Field()
  isActive: boolean;

  @Field()
  isFeatured: boolean;

  @Field(() => Float)
  rating: number;

  @Field(() => Int)
  reviewsCount: number;

  @Field(() => Int)
  viewCount: number;

  @Field(() => Int)
  soldCount: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => ID)
  categoryId: string;

  @Field(() => Category, { nullable: true })
  category?: Category;

  @Field(() => ID, { nullable: true })
  brandId?: string;

  @Field(() => Brand, { nullable: true })
  brand?: Brand;

  // Qaysi magazindan olingan — faqat admin paneli so'raydi; sayt (public)
  // so'rovlari bu maydonni so'ramaydi, shuning uchun xaridorga ko'rinmaydi.
  @Field(() => ID, { nullable: true })
  storeId?: string;

  @Field(() => Store, { nullable: true })
  store?: Store;
}
