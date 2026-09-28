import { InputType, Field, Float, ID, PartialType } from '@nestjs/graphql';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// "PERCENT" — foiz (masalan 10%), "AMOUNT" — aniq summa (masalan
// 50 000 so'm).
export const PROMO_DISCOUNT_TYPES = ['PERCENT', 'AMOUNT'] as const;

// "ALL"        — hamma tovarga amal qiladi.
// "CATEGORIES" — faqat tanlangan kategoriyalarga (masalan Krossovkalar).
// "PRODUCTS"   — faqat tanlangan aniq tovarlarga.
export const PROMO_SCOPES = ['ALL', 'CATEGORIES', 'PRODUCTS'] as const;

@InputType()
export class CreatePromoCodeInput {
  @Field()
  @IsString()
  @MinLength(2)
  code: string;

  @Field({ defaultValue: 'PERCENT' })
  @IsOptional()
  @IsIn(PROMO_DISCOUNT_TYPES as unknown as string[])
  discountType?: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  discountValue: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  // Sana ISO matn ko'rinishida keladi ("2026-10-01"). Bo'sh bo'lsa —
  // cheklov yo'q.
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  startsAt?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  endsAt?: string;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field({ defaultValue: 'ALL' })
  @IsOptional()
  @IsIn(PROMO_SCOPES as unknown as string[])
  scope?: string;

  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @Field(() => [ID], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];
}

@InputType()
export class UpdatePromoCodeInput extends PartialType(CreatePromoCodeInput) {}
