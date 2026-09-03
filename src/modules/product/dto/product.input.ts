import { InputType, Field, ID, Int, Float, PartialType } from '@nestjs/graphql';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Gender } from '../../../common/enums/gender.enum';

// The admin "add product" form's <select> for an optional relation (brand)
// naturally submits an empty string when nothing is picked. class-validator's
// @IsOptional() only skips validation for null/undefined, NOT '' — so
// without this, leaving brand unselected used to fail with a confusing
// "Bad Request Exception" (empty string isn't a valid UUID). This
// normalizes '' to undefined before @IsUUID() ever runs.
const emptyStringToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

@InputType()
export class VariantInput {
  @Field()
  @IsString()
  size: string;

  @Field()
  @IsString()
  color: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  stock: number;
}

@InputType()
export class ColorImagesInput {
  @Field()
  @IsString()
  color: string;

  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  images: string[];
}

@InputType()
export class CreateProductInput {
  @Field()
  @IsString()
  @MinLength(2)
  title: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  titleRu?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @Field()
  @IsString()
  sku: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  price: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  oldPrice?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  discountPercent?: number;

  // Aggregate total across all variants — kept in sync automatically in
  // product.service.ts whenever `variants` is provided. Still used
  // directly for products with no size/color variants at all.
  @Field(() => Int, { defaultValue: 0 })
  @IsInt()
  @Min(0)
  stock: number;

  @Field(() => [String], { defaultValue: [] })
  @IsArray()
  sizes: string[];

  @Field(() => [String], { defaultValue: [] })
  @IsArray()
  colors: string[];

  @Field(() => [String], { defaultValue: [] })
  @IsArray()
  images: string[];

  // Per-color photo sets (optional) — e.g. [{ color: "Ko'k", images: [...] }].
  // A color with no entry (or an empty images list) here just falls back to
  // the general `images` list above.
  @Field(() => [ColorImagesInput], { defaultValue: [] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColorImagesInput)
  colorImages: ColorImagesInput[];

  // Per size+color stock. Optional: a product with no sizes/colors (e.g. a
  // one-size accessory) can omit this and just use `stock` directly.
  @Field(() => [VariantInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantInput)
  variants?: VariantInput[];

  @Field(() => ID)
  @IsUUID()
  categoryId: string;

  @Field(() => ID, { nullable: true })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsUUID()
  brandId?: string;

  // Qaysi magazindan olingan (admin uchun; ixtiyoriy). Brand kabi bo'sh
  // string undefined'ga aylantiriladi — select'da hech narsa tanlanmasa
  // validatsiya xatosi chiqmasligi uchun.
  @Field(() => ID, { nullable: true })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @Field({ defaultValue: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  // Kimga mo'ljallangan: Erkaklar/Ayollar/Unisex. Admin hech narsa
  // tanlamasa ham UNISEX bilan yaratiladi — ProductForm'da select har doim
  // shu qiymat bilan default holatda keladi.
  @Field(() => Gender, { defaultValue: Gender.UNISEX })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}

@InputType()
export class UpdateProductInput extends PartialType(CreateProductInput) {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
