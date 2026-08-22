import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UZ_PHONE_REGEX, normalizePhoneValue } from '../../../common/utils/phone.util';

// See register.input.ts: phone is optional+unique, so an empty string (not
// null/undefined) from a cleared form field must be normalized before it
// hits the DB, or the next person to also clear their phone collides with
// this one on the unique constraint. Also runs non-empty values through
// normalizePhoneValue so "+998 99 213 28 01"-style spacing from the profile
// form's display formatting lands in the DB the same way register.input.ts
// already normalizes it, not as a raw copy of whatever was typed.
const emptyStringToUndefinedOrNormalized = ({ value }: { value: unknown }) => {
  if (value === '') return undefined;
  return typeof value === 'string' ? normalizePhoneValue(value) : value;
};

@InputType()
export class UpdateProfileInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @Matches(/^[^0-9]+$/, { message: 'Ism raqam bilan yozilishi mumkin emas' })
  firstName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^[^0-9]*$/, { message: 'Familiya raqam bilan yozilishi mumkin emas' })
  lastName?: string;

  @Field({ nullable: true })
  @Transform(emptyStringToUndefinedOrNormalized)
  @IsOptional()
  @IsString()
  @Matches(UZ_PHONE_REGEX, { message: 'Telefon raqam +998901234567 formatida bo‘lishi kerak' })
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  avatar?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  address?: string;
}
