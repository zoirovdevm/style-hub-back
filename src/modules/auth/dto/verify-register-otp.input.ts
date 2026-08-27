import { InputType, Field } from '@nestjs/graphql';
import { IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { UZ_PHONE_REGEX, normalizePhoneValue } from '../../../common/utils/phone.util';

// Register step 2 — the 5-digit SMS code for the phone number from step 1.
// On success the service marks that PhoneOtp row verified for a bounded
// window (see auth.service.ts), which is what register() checks for later
// — this mutation itself does not create or touch any User row.
@InputType()
export class VerifyRegisterOtpInput {
  @Field()
  @Transform(({ value }) => normalizePhoneValue(value))
  @IsString()
  @Matches(UZ_PHONE_REGEX, { message: 'Telefon raqam +998901234567 formatida bo‘lishi kerak' })
  phone: string;

  @Field()
  @IsString()
  @Length(5, 5)
  code: string;
}
