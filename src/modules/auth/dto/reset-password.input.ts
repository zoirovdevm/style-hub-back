import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsOptional, Length, MinLength } from 'class-validator';

// Two mutually-exclusive shapes now live in one input, matching the two
// forgot-password paths in AuthService.resetPassword:
//   - email path:  { token, newPassword }              (link from the email)
//   - phone path:  { identifier, code, newPassword }    (5-digit SMS code)
// All three of token/identifier/code are optional here on purpose — the
// service is what enforces that exactly one complete shape was sent (a
// stray `token` together with `identifier`/`code` just makes the service
// take the token branch, since that's the one that doesn't require a
// second round-trip to know which account to touch).
@InputType()
export class ResetPasswordInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  token?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  identifier?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(5, 5)
  code?: string;

  @Field()
  @IsString()
  @MinLength(6)
  newPassword: string;
}
