import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty } from 'class-validator';

// Was `email: string` (@IsEmail) — login now accepts either a phone number
// or an email in the same field, so this can't be @IsEmail anymore. The
// service is what actually figures out which one it is (see
// AuthService.detectIdentifierType) and looks the user up accordingly;
// this DTO only guarantees something non-empty was sent.
@InputType()
export class LoginInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @Field()
  @IsString()
  password: string;
}
