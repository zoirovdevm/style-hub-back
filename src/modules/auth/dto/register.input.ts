import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

// `phone` is optional and unique in the DB. A registration form that lets
// phone be left blank naturally submits '' (not null/undefined) — and
// since '' is a real, distinct string value, the SECOND person who also
// leaves phone blank collides with the first on the unique constraint.
// Normalizing '' to undefined means it's stored as NULL instead, and SQL
// treats every NULL as distinct from every other NULL for uniqueness.
const emptyStringToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

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

  @Field({ nullable: true })
  @Transform(emptyStringToUndefined)
  @IsOptional()
  @IsString()
  phone?: string;
}
