import { InputType, Field, Int, Float, registerEnumType } from '@nestjs/graphql';
import { IsOptional, IsInt, IsString, Min, IsArray } from 'class-validator';

export enum ProductSort {
  NEWEST = 'NEWEST',
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  MOST_POPULAR = 'MOST_POPULAR',
  TOP_RATED = 'TOP_RATED',
  // Har safar aralashtirib beradi — bosh sahifa shuni ishlatadi, shunda
  // saytga kirgan odam har gal boshqa tovarlarni ko'radi. Do'kon
  // sahifasidagi saralash ro'yxatiga qo'shilmagan (u yerda sahifalash
  // bo'lgani uchun tartib barqaror bo'lishi kerak) — faqat bosh sahifa
  // uchun mo'ljallangan.
  RANDOM = 'RANDOM',
}

registerEnumType(ProductSort, { name: 'ProductSort' });

@InputType()
export class ProductFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  brandSlug?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  sizes?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  colors?: string[];

  @Field(() => Float, { nullable: true })
  @IsOptional()
  minPrice?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  maxPrice?: number;

  @Field({ nullable: true })
  @IsOptional()
  onlyFeatured?: boolean;

  // Brend/kategoriya bilan bir xil — admin o'zi yaratgan Gender yozuvining
  // slug'i bo'yicha filtrlash (masalan "erkaklar").
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  genderSlug?: string;

  @Field(() => ProductSort, { defaultValue: ProductSort.NEWEST })
  @IsOptional()
  sort: ProductSort;

  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  page: number;

  @Field(() => Int, { defaultValue: 12 })
  @IsInt()
  @Min(1)
  limit: number;
}
