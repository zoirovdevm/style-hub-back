import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthPayload } from './dto/auth-payload.object';
import { RegisterResult } from './dto/register-result.object';
import { RegisterInput } from './dto/register.input';
import { LoginInput } from './dto/login.input';
import { VerifyEmailInput } from './dto/verify-email.input';
import { Public } from '../../common/decorators/public.decorator';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Mutation(() => RegisterResult)
  register(@Args('input') input: RegisterInput) {
    return this.authService.register(input);
  }

  @Public()
  @Mutation(() => AuthPayload)
  verifyEmail(@Args('input') input: VerifyEmailInput) {
    return this.authService.verifyEmail(input);
  }

  @Public()
  @Mutation(() => Boolean)
  resendVerificationCode(@Args('email') email: string) {
    return this.authService.resendVerificationCode(email);
  }

  @Public()
  @Mutation(() => AuthPayload)
  login(@Args('input') input: LoginInput) {
    return this.authService.login(input);
  }

  @Public()
  @Mutation(() => AuthPayload)
  refreshToken(@Args('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }
}
