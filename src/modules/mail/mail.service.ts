import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('mail.host');
    const user = this.config.get<string>('mail.user');
    const pass = this.config.get<string>('mail.pass');

    // Without real SMTP credentials configured, sendVerificationCode() below
    // falls back to logging the code to the console instead of failing —
    // lets registration/login be tested end-to-end before setting up a
    // real mailbox.
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('mail.port'),
        secure: this.config.get<number>('mail.port') === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP sozlanmagan (.env dagi SMTP_HOST/SMTP_USER/SMTP_PASS bo‘sh) — tasdiqlash kodlari konsolga chiqariladi.');
    }
  }

  async sendVerificationCode(email: string, code: string) {
    if (!this.transporter) {
      this.logger.log(`[EMAIL TASDIQLASH KODI] ${email} -> ${code} (SMTP sozlanmagani uchun email jo'natilmadi)`);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.config.get<string>('mail.from'),
        to: email,
        subject: 'StyleHub — tasdiqlash kodi',
        html: `
          <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
            <h2 style="color:#111114;">StyleHub</h2>
            <p>Ro'yxatdan o'tishni tasdiqlash uchun quyidagi kodni kiriting:</p>
            <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color:#111114;">${code}</p>
            <p style="color:#888;">Kod 15 daqiqa amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, shunchaki e'tiborsiz qoldiring.</p>
          </div>
        `,
      });
      // Explicit success confirmation — previously there was no log at all
      // on the "real SMTP configured" path, so a successful send and a
      // silent failure looked identical in the terminal.
      this.logger.log(`Email yuborildi: ${email} (messageId: ${info.messageId}, response: ${info.response})`);
    } catch (error) {
      this.logger.error(`Email yuborishda XATOLIK (${email}): ${(error as Error).message}`);
      // Fall back to logging the code so testing can still continue even
      // if the real send failed (e.g. wrong app password, network block).
      this.logger.log(`[EMAIL TASDIQLASH KODI] ${email} -> ${code}`);
    }
  }
}
