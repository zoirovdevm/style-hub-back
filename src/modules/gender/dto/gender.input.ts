import { InputType, Field, PartialType } from '@nestjs/graphql';
import { IsString, MinLength } from 'class-validator';

@InputType()
export class CreateGenderInput {
  @Field()
  @IsString()
  @MinLength(2)
  name: string;
}

@InputType()
export class UpdateGenderInput extends PartialType(CreateGenderInput) {}
