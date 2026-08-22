import { ObjectType, Field } from '@nestjs/graphql';

// Was { email, phone } (both always echoed back regardless of which
// channel — or whether an account — actually existed). Now that
// forgot-password branches into two genuinely different flows (SMS OTP vs.
// emailed link), the frontend needs to know which screen to show next —
// `method` carries exactly that, and nothing else, so this still can't be
// used to probe whether a given phone/email is registered (same
// not-found-still-returns-normally behavior as before, see
// AuthService.requestPasswordReset).
@ObjectType()
export class PasswordResetRequestResult {
  @Field()
  method: 'PHONE' | 'EMAIL';
}
