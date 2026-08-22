import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { MailService } from '../mail/mail.service';
import { RegisterInput } from './dto/register.input';
import { SendRegisterOtpInput } from './dto/send-register-otp.input';
import { VerifyRegisterOtpInput } from './dto/verify-register-otp.input';
import { LoginInput } from './dto/login.input';
import { VerifyEmailInput } from './dto/verify-email.input';
import { RequestPasswordResetInput } from './dto/request-password-reset.input';
import { ResetPasswordInput } from './dto/reset-password.input';
import { Role } from '../../common/enums/role.enum';
import { UZ_PHONE_REGEX, normalizePhoneValue } from '../../common/utils/phone.util';

const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;

// Register-step phone OTP (PhoneOtp table) — deliberately its own, shorter
// set of constants, separate from VERIFICATION_CODE_TTL_MS above (the
// legacy post-create email/SMS verification, still 15 min) and from the
// forgot-password codes further down. Matches the product spec exactly:
// 5-minute expiry, capped wrong-code attempts, and a resend cooldown.
const REGISTER_OTP_TTL_MS = 5 * 60 * 1000;
const REGISTER_OTP_MAX_ATTEMPTS = 5;
const REGISTER_OTP_RESEND_COOLDOWN_MS = 60 * 1000;
// How long a verified PhoneOtp stays usable to actually create the account
// — covers the time the buyer spends on the "personal info" + confirmation
// steps after the code is confirmed, without leaving verification valid
// forever.
const REGISTER_OTP_VERIFIED_WINDOW_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly sms: SmsService,
    private readonly mail: MailService,
  ) {}

  // Sends the code down both channels at once and doesn't let one failure
  // block the other — SMS needs a working Eskiz account to actually
  // deliver (falls back to a console log otherwise), while email already
  // works via the Gmail SMTP config. Until Eskiz is set up, the buyer
  // still gets a working code by email.
  private async deliverCode(email: string, phone: string, code: string) {
    await Promise.allSettled([this.sms.sendVerificationCode(phone, code), this.mail.sendVerificationCode(email, code)]);
  }

  private generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Register phone step and forgot-password SMS step both used to get a
  // fixed '123456' outside production (a leftover test-mode shortcut so the
  // flow could be exercised without a real SMS provider). Now that a real
  // provider is wired up (SmsService — own-phone gateway / Eskiz / Twilio),
  // this always hands out a real random code, in every environment.
  private generateOtp() {
    return this.generateCode();
  }

  // '+998901234567' -> PHONE, anything with an '@' -> EMAIL, anything else
  // is rejected. This only classifies the *shape* of what was typed — same
  // caveat as UZ_PHONE_REGEX itself, it proves nothing about whether the
  // number/address is real.
  private detectIdentifierType(identifier: string): 'PHONE' | 'EMAIL' {
    const normalized = normalizePhoneValue(identifier);
    if (UZ_PHONE_REGEX.test(normalized)) return 'PHONE';
    if (identifier.includes('@')) return 'EMAIL';
    throw new BadRequestException('Telefon raqami yoki email noto‘g‘ri formatda');
  }

  private async issueTokens(userId: string, role: Role) {
    const payload = { sub: userId, role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
    });

    return { accessToken, refreshToken };
  }

  // Register step 1+2 combined: format is already validated by
  // SendRegisterOtpInput by the time this runs, so this only has to check
  // whether the number is already taken (the "2-qadam" check from the
  // spec) and, if not, hand out an OTP — never both an existence-error and
  // an SMS send for the same call.
  async sendRegisterOtp(input: SendRegisterOtpInput) {
    const existingUser = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (existingUser) {
      throw new ConflictException('Bu telefon raqami allaqachon ro‘yxatdan o‘tgan. Iltimos, tizimga kiring yoki boshqa raqamdan foydalaning.');
    }

    const existingOtp = await this.prisma.phoneOtp.findUnique({ where: { phone: input.phone } });
    if (existingOtp && Date.now() - existingOtp.lastSentAt.getTime() < REGISTER_OTP_RESEND_COOLDOWN_MS) {
      throw new BadRequestException('SMS yuborildi. Iltimos, biroz kuting va qaytadan urining.');
    }

    const code = this.generateOtp();
    const now = new Date();
    await this.prisma.phoneOtp.upsert({
      where: { phone: input.phone },
      create: { phone: input.phone, code, expiresAt: new Date(now.getTime() + REGISTER_OTP_TTL_MS), lastSentAt: now },
      update: { code, expiresAt: new Date(now.getTime() + REGISTER_OTP_TTL_MS), attempts: 0, verified: false, verifiedAt: null, lastSentAt: now },
    });

    await this.sms.sendVerificationCode(input.phone, code);
    return true;
  }

  // Register step 3 — checks the code against the PhoneOtp row from
  // sendRegisterOtp above. Does not create or touch any User row; it only
  // flips PhoneOtp.verified, which register() below checks for.
  async verifyRegisterOtp(input: VerifyRegisterOtpInput) {
    const record = await this.prisma.phoneOtp.findUnique({ where: { phone: input.phone } });
    if (!record) throw new BadRequestException('Avval SMS kod so‘rang');

    if (record.attempts >= REGISTER_OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Urinishlar soni tugadi. Kodni qayta yuboring.');
    }

    if (!record.expiresAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Kod muddati tugagan. Kodni qayta yuboring.');
    }

    if (record.code !== input.code) {
      await this.prisma.phoneOtp.update({ where: { phone: input.phone }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('Kod noto‘g‘ri');
    }

    await this.prisma.phoneOtp.update({
      where: { phone: input.phone },
      data: { verified: true, verifiedAt: new Date(), attempts: 0 },
    });
    return true;
  }

  // Register step 4+5+6: personal info was already collected and shown
  // back to the buyer in the confirmation modal on the frontend — this is
  // the "Tasdiqlash" call that actually creates the account. Requires the
  // phone to already be verified (step 3) and re-checks both phone and
  // email uniqueness here (the phone check especially matters: nothing
  // stops two tabs/devices from verifying the same number and racing to
  // register). Returns full tokens now — registration logs the buyer in
  // immediately, there's no separate "confirm your account" step anymore.
  async register(input: RegisterInput) {
    const phoneOtp = await this.prisma.phoneOtp.findUnique({ where: { phone: input.phone } });
    const verifiedRecently =
      phoneOtp?.verified && phoneOtp.verifiedAt && Date.now() - phoneOtp.verifiedAt.getTime() < REGISTER_OTP_VERIFIED_WINDOW_MS;
    if (!verifiedRecently) {
      throw new BadRequestException('Telefon raqami tasdiqlanmagan. Avval SMS kodni tasdiqlang.');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('Bu email allaqachon ro‘yxatdan o‘tgan');

    const existingPhone = await this.prisma.user.findUnique({ where: { phone: input.phone } });
    if (existingPhone) throw new ConflictException('Bu telefon raqam allaqachon ro‘yxatdan o‘tgan');

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        address: input.address,
        role: Role.USER,
        phoneVerified: true,
        emailVerified: false,
      },
    });

    // Best-effort cleanup — a failure here has zero effect on the account
    // that was just created, so it's not worth failing the whole request
    // over.
    await this.prisma.phoneOtp.delete({ where: { phone: input.phone } }).catch(() => {});

    const tokens = await this.issueTokens(user.id, user.role as Role);
    return { ...tokens, user };
  }

  async verifyEmail(input: VerifyEmailInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new NotFoundException('Bunday foydalanuvchi topilmadi');
    if (user.phoneVerified) throw new BadRequestException('Telefon raqam allaqachon tasdiqlangan');

    if (
      !user.verificationCode ||
      user.verificationCode !== input.code ||
      !user.verificationCodeExpiresAt ||
      user.verificationCodeExpiresAt < new Date()
    ) {
      throw new BadRequestException('Kod noto‘g‘ri yoki muddati tugagan');
    }

    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true, verificationCode: null, verificationCodeExpiresAt: null, lastSeenAt: new Date() },
    });

    const tokens = await this.issueTokens(verified.id, verified.role as Role);
    return { ...tokens, user: verified };
  }

  async resendVerificationCode(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('Bunday foydalanuvchi topilmadi');
    if (user.phoneVerified) throw new BadRequestException('Telefon raqam allaqachon tasdiqlangan');
    if (!user.phone) throw new BadRequestException('Telefon raqam topilmadi');

    const code = this.generateCode();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { verificationCode: code, verificationCodeExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS) },
    });

    await this.deliverCode(user.email, user.phone, code);
    return true;
  }

  // `identifier` is either a phone or an email — detectIdentifierType()
  // figures out which and looks the user up on the matching unique column.
  // Everything else here (password check, isActive, phoneVerified gate,
  // token issuance) is unchanged from before.
  async login(input: LoginInput) {
    const type = this.detectIdentifierType(input.identifier);
    const user =
      type === 'PHONE'
        ? await this.prisma.user.findUnique({ where: { phone: normalizePhoneValue(input.identifier) } })
        : await this.prisma.user.findUnique({ where: { email: input.identifier.trim().toLowerCase() } });
    if (!user) throw new UnauthorizedException('Login ma’lumotlari noto‘g‘ri');

    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Login ma’lumotlari noto‘g‘ri');
    if (!user.isActive) throw new UnauthorizedException('Hisob bloklangan');
    if (!user.phoneVerified) throw new BadRequestException('PHONE_NOT_VERIFIED');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });

    const tokens = await this.issueTokens(user.id, user.role as Role);
    return { ...tokens, user };
  }

  // Forgot-password flow — branches on identifier type into two genuinely
  // different mechanisms (spec 3. FORGOT PASSWORD):
  //   PHONE -> 6-digit SMS code, confirmed on this same reset-password page
  //   EMAIL -> single-use link emailed to them, no code to type at all
  // Deliberately doesn't reveal whether the account exists in either
  // branch — an unknown phone/email still returns the same shape (just
  // doesn't send anything), same enumeration-safety property the old
  // email-only version had.
  async requestPasswordReset(input: RequestPasswordResetInput) {
    const type = this.detectIdentifierType(input.identifier);

    if (type === 'PHONE') {
      const phone = normalizePhoneValue(input.identifier);
      const user = await this.prisma.user.findUnique({ where: { phone } });
      if (user) {
        const code = this.generateOtp();
        await this.prisma.user.update({
          where: { id: user.id },
          data: { resetCode: code, resetCodeExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS) },
        });
        await this.sms.sendVerificationCode(user.phone as string, code);
      }
      return { method: 'PHONE' as const };
    }

    const email = input.identifier.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetTokenExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS) },
      });
      const link = `${this.config.get<string>('corsOrigin')}/reset-password?token=${token}`;
      await this.mail.sendPasswordResetLink(user.email, link);
    }
    return { method: 'EMAIL' as const };
  }

  // Two mutually-exclusive input shapes, matching the two
  // requestPasswordReset branches above — see ResetPasswordInput's own
  // comment for why both live in one DTO.
  async resetPassword(input: ResetPasswordInput) {
    if (input.token) {
      const user = await this.prisma.user.findUnique({ where: { resetToken: input.token } });
      if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
        throw new BadRequestException('Havola yaroqsiz yoki muddati tugagan');
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 10);
      const updated = await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, resetToken: null, resetTokenExpiresAt: null, lastSeenAt: new Date() },
      });

      const tokens = await this.issueTokens(updated.id, updated.role as Role);
      return { ...tokens, user: updated };
    }

    if (!input.identifier || !input.code) {
      throw new BadRequestException('Kod va telefon/email kiritilishi shart');
    }

    const type = this.detectIdentifierType(input.identifier);
    const user =
      type === 'PHONE'
        ? await this.prisma.user.findUnique({ where: { phone: normalizePhoneValue(input.identifier) } })
        : await this.prisma.user.findUnique({ where: { email: input.identifier.trim().toLowerCase() } });
    if (!user) throw new NotFoundException('Bunday foydalanuvchi topilmadi');

    if (
      !user.resetCode ||
      user.resetCode !== input.code ||
      !user.resetCodeExpiresAt ||
      user.resetCodeExpiresAt < new Date()
    ) {
      throw new BadRequestException('Kod noto‘g‘ri yoki muddati tugagan');
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetCode: null, resetCodeExpiresAt: null, lastSeenAt: new Date() },
    });

    // Log the user straight in afterwards — same convenience verifyEmail()
    // already gives on the registration path, so they don't have to type
    // their brand-new password a second time immediately.
    const tokens = await this.issueTokens(updated.id, updated.role as Role);
    return { ...tokens, user: updated };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new UnauthorizedException();

      const tokens = await this.issueTokens(user.id, user.role as Role);
      return { ...tokens, user };
    } catch {
      throw new UnauthorizedException('Refresh token yaroqsiz');
    }
  }
}
