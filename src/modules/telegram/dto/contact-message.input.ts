import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

@InputType()
export class ContactMessageInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  // Deliberately not an email — the site's own OTP emails have had spam
  // deliverability problems, and a phone number or Telegram username is a
  // much more reliable way for the admin to actually reach this person
  // back (matches how payment confirmation already works over Telegram).
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contact: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
