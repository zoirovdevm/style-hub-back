import { InputType, Field, Int, Float, registerEnumType } from '@nestjs/graphql';
import { IsOptional, IsInt, IsString, Min, IsArray, IsEnum } from 'class-validator';
import { Gender } from '../../../common/enums/gender.enum';

export enum ProductSort {
  NEWEST = 'NEWEST',
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  MOST_POPULAR = 'MOST_POPULAR',
  TOP_RATED = 'TOP_RATED',
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

  @Field(() => Gender, { nullable: true })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

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
