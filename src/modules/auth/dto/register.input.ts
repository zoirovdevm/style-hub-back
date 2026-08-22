import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength, IsNotEmpty, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { UZ_PHONE_REGEX, normalizePhoneValue } from '../../../common/utils/phone.util';

@InputType()
export class RegisterInput {
  // Only Gmail addresses are accepted for now — normalized to lowercase
  // first so "Name@GMAIL.com" doesn't slip past the @gmail.com check, and
  // so the same address always ends up stored the same way (matches the
  // lowercase-on-lookup convention login()/requestPasswordReset() already
  // use for email).
  @Field()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @Matches(/^[^\s@]+@gmail\.com$/, { message: 'Email manzil @gmail.com bilan tugashi kerak' })
  email: string;

  @Field()
  @IsString()
  @MinLength(6)
  password: string;

  @Field()
  @IsString()
  @MinLength(2)
  @Matches(/^[^0-9]+$/, { message: 'Ism raqam bilan yozilishi mumkin emas' })
  firstName: string;

  @Field()
  @IsString()
  @MinLength(2)
  @Matches(/^[^0-9]+$/, { message: 'Familiya raqam bilan yozilishi mumkin emas' })
  lastName: string;

  // Verification already happened in a previous step (sendRegisterOtp +
  // verifyRegisterOtp) — the service checks that a matching, recently-
  // verified PhoneOtp row exists for this exact number before it will
  // create the account, so this field just has to be in the right shape.
  @Field()
  @Transform(({ value }) => normalizePhoneValue(value))
  @IsString()
  @Matches(UZ_PHONE_REGEX, { message: 'Telefon raqam +998901234567 formatida bo‘lishi kerak' })
  phone: string;

  // Required per the new registration form — was optional/absent before
  // since the old single-step form never collected it here (address used
  // to only be settable later from the profile page).
  @Field()
  @IsString()
  @IsNotEmpty({ message: 'Manzil kiritilishi shart' })
  address: string;
}
