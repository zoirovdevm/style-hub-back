import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsString, Length } from 'class-validator';

@InputType()
export class VerifyEmailInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @Length(5, 5)
  code: string;
}
