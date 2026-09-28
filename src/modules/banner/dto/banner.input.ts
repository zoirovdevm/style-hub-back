import { InputType, Field, Int, PartialType } from '@nestjs/graphql';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

// "NONE"     — banner bosilmaydi, shunchaki rasm.
// "PRODUCT"  — productId majburiy, bosilganda mahsulot sahifasiga o'tadi.
// "PRODUCTS" — productIds majburiy: bitta bannerga bir NECHTA tovar
//              biriktiriladi (masalan krossovka + ko'ylak + futbolka),
//              bosilganda do'kon sahifasi faqat o'sha tovarlarni
//              ko'rsatadi.
// "CATEGORY" — categoryId majburiy, bosilganda kategoriya sahifasiga.
export const BANNER_LINK_TYPES = ['NONE', 'PRODUCT', 'PRODUCTS', 'CATEGORY'] as const;

@InputType()
export class CreateBannerInput {
  @Field()
  @IsString()
  @MinLength(1)
  image: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  titleRu?: string;

  @Field({ defaultValue: 'NONE' })
  @IsOptional()
  @IsIn(BANNER_LINK_TYPES as unknown as string[])
  linkType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  productId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

@InputType()
export class UpdateBannerInput extends PartialType(CreateBannerInput) {}
