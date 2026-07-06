import { ObjectType, Field } from '@nestjs/graphql';

// Deliberately does NOT include tokens — registration no longer logs the
// user in immediately. The frontend uses this `email` to route the buyer
// to the "enter your verification code" screen; a real session (AuthPayload)
// is only issued once verifyEmail() succeeds.
@ObjectType()
export class RegisterResult {
  @Field()
  email: string;
}
