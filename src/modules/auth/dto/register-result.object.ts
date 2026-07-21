import { ObjectType, Field } from '@nestjs/graphql';

// Deliberately does NOT include tokens — registration no longer logs the
// user in immediately. The frontend uses `email` to route the buyer to the
// "enter your verification code" screen (and as the lookup key for
// verify/resend); `phone` is only for display, so they can confirm the SMS
// went to the right number. A real session (AuthPayload) is only issued
// once verifyEmail() succeeds.
@ObjectType()
export class RegisterResult {
  @Field()
  email: string;

  @Field()
  phone: string;
}
