import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

// See register.input.ts: phone is optional+unique, so an empty string (not
// null/undefined) from a cleared form field must be normalized before it
// hits the DB, or the next person to also clear their phone collides with
// this one on the unique constraint.
const emptyStringToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

@InputType()
export class UpdateProfileInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(2)
  firstName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  lastName?: string;

  @Field({ nullable: true })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsString()
  phone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  avatar?: string;
}
