import { InputType, Field } from '@nestjs/graphql';
import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { UZ_PHONE_REGEX, normalizePhoneValue } from '../../../common/utils/phone.util';

// Register step 1 — phone number only. The service checks the format here,
// then (before sending anything) checks whether the number is already
// registered and, only if not, sends the SMS OTP. Reused for "resend" too:
// the frontend just calls this mutation again, and the service's own
// cooldown check is what actually rate-limits repeat sends.
@InputType()
export class SendRegisterOtpInput {
  @Field()
  @Transform(({ value }) => normalizePhoneValue(value))
  @IsString()
  @Matches(UZ_PHONE_REGEX, { message: 'Telefon raqam +998901234567 formatida bo‘lishi kerak' })
  phone: string;
}
