import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthPayload } from './dto/auth-payload.object';
import { RegisterInput } from './dto/register.input';
import { SendRegisterOtpInput } from './dto/send-register-otp.input';
import { VerifyRegisterOtpInput } from './dto/verify-register-otp.input';
import { LoginInput } from './dto/login.input';
import { VerifyEmailInput } from './dto/verify-email.input';
import { RequestPasswordResetInput } from './dto/request-password-reset.input';
import { ResetPasswordInput } from './dto/reset-password.input';
import { PasswordResetRequestResult } from './dto/password-reset-request-result.object';
import { Public } from '../../common/decorators/public.decorator';

// Tight limit for anything that can be used to brute-force a password,
// spam a stranger's inbox/phone with codes, or enumerate accounts.
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Mutation(() => Boolean)
  sendRegisterOtp(@Args('input') input: SendRegisterOtpInput) {
    return this.authService.sendRegisterOtp(input);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Mutation(() => Boolean)
  verifyRegisterOtp(@Args('input') input: VerifyRegisterOtpInput) {
    return this.authService.verifyRegisterOtp(input);
  }

  // Was `@Mutation(() => RegisterResult)` returning just { email, phone }
  // with no tokens — registration now happens after the phone is already
  // verified (sendRegisterOtp + verifyRegisterOtp above), so this is the
  // final "create the account" call and logs the buyer straight in.
  @Public()
  @Throttle(AUTH_THROTTLE)
  @Mutation(() => AuthPayload)
  register(@Args('input') input: RegisterInput) {
    return this.authService.register(input);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Mutation(() => AuthPayload)
  verifyEmail(@Args('input') input: VerifyEmailInput) {
    return this.authService.verifyEmail(input);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Mutation(() => Boolean)
  resendVerificationCode(@Args('email') email: string) {
    return this.authService.resendVerificationCode(email);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Mutation(() => AuthPayload)
  login(@Args('input') input: LoginInput) {
    return this.authService.login(input);
  }

  @Public()
  @Mutation(() => AuthPayload)
  refreshToken(@Args('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Mutation(() => PasswordResetRequestResult)
  requestPasswordReset(@Args('input') input: RequestPasswordResetInput) {
    return this.authService.requestPasswordReset(input);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Mutation(() => AuthPayload)
  resetPassword(@Args('input') input: ResetPasswordInput) {
    return this.authService.resetPassword(input);
  }
}
