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
        subject: 'Wardrobe — tasdiqlash kodi',
        // A plain-text alternative alongside the HTML body is standard
        // deliverability practice — spam filters treat HTML-only mail
        // (especially from a personal Gmail account rather than a
        // dedicated transactional mail service) as a weak signal on its
        // own; having both lets the receiving client pick whichever it
        // trusts more.
        text: `Wardrobe tasdiqlash kodi: ${code}\n\nKod 15 daqiqa amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, shunchaki e'tiborsiz qoldiring.`,
        html: `
          <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
            <h2 style="color:#111114;">Wardrobe</h2>
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

  // Forgot-password / email path — sends a clickable reset *link* instead
  // of a code, since there's no separate "enter the code" screen for this
  // path (the phone path uses sendVerificationCode above for that). Same
  // configured/not-configured fallback as sendVerificationCode: without
  // real SMTP creds this just logs the link so the flow can still be
  // tested end-to-end.
  async sendPasswordResetLink(email: string, link: string) {
    if (!this.transporter) {
      this.logger.log(`[PAROLNI TIKLASH HAVOLASI] ${email} -> ${link} (SMTP sozlanmagani uchun email jo'natilmadi)`);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.config.get<string>('mail.from'),
        to: email,
        subject: 'Wardrobe — parolni tiklash',
        text: `Parolni tiklash uchun quyidagi havolani oching:\n${link}\n\nHavola 15 daqiqa amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, shunchaki e'tiborsiz qoldiring.`,
        html: `
          <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
            <h2 style="color:#111114;">Wardrobe</h2>
            <p>Parolni tiklash uchun quyidagi tugmani bosing:</p>
            <p><a href="${link}" style="display:inline-block; padding:12px 24px; background:#10b981; color:#fff; border-radius:999px; text-decoration:none; font-weight:bold;">Parolni tiklash</a></p>
            <p style="color:#888; word-break: break-all;">Yoki havolani nusxalab brauzerga qo'ying: ${link}</p>
            <p style="color:#888;">Havola 15 daqiqa amal qiladi. Agar bu so'rovni siz yubormagan bo'lsangiz, shunchaki e'tiborsiz qoldiring.</p>
          </div>
        `,
      });
      this.logger.log(`Parolni tiklash havolasi yuborildi: ${email} (messageId: ${info.messageId}, response: ${info.response})`);
    } catch (error) {
      this.logger.error(`Parolni tiklash havolasini yuborishda XATOLIK (${email}): ${(error as Error).message}`);
      this.logger.log(`[PAROLNI TIKLASH HAVOLASI] ${email} -> ${link}`);
    }
  }
}
