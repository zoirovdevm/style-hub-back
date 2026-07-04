import { InputType, Field, PartialType } from '@nestjs/graphql';
import { IsOptional, IsString, MinLength } from 'class-validator';

@InputType()
export class CreateBrandInput {
  @Field()
  @IsString()
  @MinLength(2)
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  logo?: string;
}

@InputType()
export class UpdateBrandInput extends PartialType(CreateBrandInput) {}
