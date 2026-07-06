import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterInput } from './dto/register.input';
import { LoginInput } from './dto/login.input';
import { VerifyEmailInput } from './dto/verify-email.input';
import { Role } from '../../common/enums/role.enum';

const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
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

  async register(input: RegisterInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('Bu email allaqachon ro‘yxatdan o‘tgan');

    const passwordHash = await bcrypt.hash(input.password, 10);
    const code = this.generateCode();

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role: Role.USER,
        emailVerified: false,
        verificationCode: code,
        verificationCodeExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
      },
    });

    await this.mail.sendVerificationCode(user.email, code);

    // No tokens here on purpose — the account isn't usable until the code
    // is confirmed via verifyEmail(). Only the email is returned so the
    // frontend knows which address to show the code-entry screen for.
    return { email: user.email };
  }

  async verifyEmail(input: VerifyEmailInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new NotFoundException('Bunday foydalanuvchi topilmadi');
    if (user.emailVerified) throw new BadRequestException('Email allaqachon tasdiqlangan');

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
      data: { emailVerified: true, verificationCode: null, verificationCodeExpiresAt: null, lastSeenAt: new Date() },
    });

    const tokens = await this.issueTokens(verified.id, verified.role as Role);
    return { ...tokens, user: verified };
  }

  async resendVerificationCode(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('Bunday foydalanuvchi topilmadi');
    if (user.emailVerified) throw new BadRequestException('Email allaqachon tasdiqlangan');

    const code = this.generateCode();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { verificationCode: code, verificationCodeExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS) },
    });

    await this.mail.sendVerificationCode(email, code);
    return true;
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new UnauthorizedException('Email yoki parol noto‘g‘ri');

    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Email yoki parol noto‘g‘ri');
    if (!user.isActive) throw new UnauthorizedException('Hisob bloklangan');
    if (!user.emailVerified) throw new BadRequestException('EMAIL_NOT_VERIFIED');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });

    const tokens = await this.issueTokens(user.id, user.role as Role);
    return { ...tokens, user };
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
