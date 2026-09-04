import { InputType, Field, PartialType } from '@nestjs/graphql';
import { IsOptional, IsString, MinLength } from 'class-validator';

@InputType()
export class CreateGenderInput {
  @Field()
  @IsString()
  @MinLength(2)
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  nameRu?: string;
}

@InputType()
export class UpdateGenderInput extends PartialType(CreateGenderInput) {}
