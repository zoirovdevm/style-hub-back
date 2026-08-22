import { InputType, Field, Float, PartialType } from '@nestjs/graphql';
import { IsOptional, IsString, MinLength, Min, Max } from 'class-validator';

@InputType()
export class CreateStoreInput {
  @Field()
  @IsString()
  @MinLength(2)
  name: string;

  // Admin shu magazinchi bilan ishlaydigan komissiya foizi (0-100).
  // Berilmasa 0% bilan boshlanadi — keyin magazin sahifasidan o'zgartirish
  // mumkin.
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @Min(0)
  @Max(100)
  commissionPercent?: number;
}

@InputType()
export class UpdateStoreInput extends PartialType(CreateStoreInput) {}
