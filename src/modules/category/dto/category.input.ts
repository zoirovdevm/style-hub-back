import { InputType, Field, PartialType } from '@nestjs/graphql';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class CreateCategoryInput {
  @Field()
  @IsString()
  @MinLength(2)
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  nameRu?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  image?: string;

  // O'lchamlar ro'yxati. Yuborilmasa — o'zgarmaydi; null — avtomatik
  // (nomiga qarab); [] — o'lchamsiz; ["1","2",…] — aynan shu ro'yxat.
  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  sizeOptions?: string[] | null;
}

@InputType()
export class UpdateCategoryInput extends PartialType(CreateCategoryInput) {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
