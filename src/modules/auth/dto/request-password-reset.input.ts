import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty } from 'class-validator';

// Was `email: string` (@IsEmail) — forgot-password now accepts either a
// phone number or an email in the same field; AuthService.detectIdentifierType
// decides which, and branches to the SMS-OTP path or the emailed-link path
// accordingly. This DTO only guarantees something non-empty was sent.
@InputType()
export class RequestPasswordResetInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
