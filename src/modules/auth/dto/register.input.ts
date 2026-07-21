import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

// Strips spaces/dashes/parens so "+998 (90) 123-45-67" and "+998901234567"
// both normalize to the same stored value — needed since the verification
// code is sent to this exact number via SMS.
const normalizePhone = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/[^\d+]/g, '') : value);

@InputType()
export class RegisterInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsString()
  @MinLength(6)
  password: string;

  @Field()
  @IsString()
  @MinLength(2)
  firstName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  lastName?: string;

  // Required now — the registration OTP is delivered via SMS to this
  // number, so an account can't be created (or verified) without it.
  @Field()
  @Transform(normalizePhone)
  @IsString()
  @Matches(/^\+998\d{9}$/, { message: 'Telefon raqam +998901234567 formatida bo‘lishi kerak' })
  phone: string;
}
