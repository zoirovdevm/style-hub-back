import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Twilio (https://www.twilio.com) — signup is just an email + phone
// verification (no business/legal documents required to create the
// account), and Uzbekistan is on Twilio's supported SMS list. Auth is plain
// HTTP Basic (Account SID as username, Auth Token as password) — no
// separate login/token step like Eskiz needed.
//
// IMPORTANT trial-account caveat: a brand-new Twilio trial account can only
// send SMS to phone numbers you've manually verified in the Twilio console
// (Phone Numbers → Verified Caller IDs) — this is Twilio's own anti-abuse
// limit, not a bug here. Add a payment method (Twilio gives ~$15 trial
// credit) to lift that restriction and send to any number.
const TWILIO_BASE_URL = 'https://api.twilio.com/2010-04-01';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.accountSid = this.config.get<string>('sms.accountSid') ?? '';
    this.authToken = this.config.get<string>('sms.authToken') ?? '';
    this.from = this.config.get<string>('sms.from') ?? '';

    if (!this.configured) {
      this.logger.warn(
        'Twilio sozlanmagan (.env dagi TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM bo‘sh) — tasdiqlash kodlari konsolga chiqariladi.',
      );
    }
  }

  private get configured() {
    return !!(this.accountSid && this.authToken && this.from);
  }

  async sendVerificationCode(phone: string, code: string) {
    const message = `StyleHub tasdiqlash kodingiz: ${code}`;

    if (!this.configured) {
      this.logger.log(`[SMS TASDIQLASH KODI] ${phone} -> ${code} (Twilio sozlanmagani uchun SMS jo'natilmadi)`);
      return;
    }

    try {
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      // A Messaging Service SID (starts with "MG") goes in a different
      // field than a plain phone number — supporting both means either
      // kind of value in TWILIO_FROM just works.
      const fromField = this.from.startsWith('MG') ? 'MessagingServiceSid' : 'From';

      const res = await fetch(`${TWILIO_BASE_URL}/Accounts/${this.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, Body: message, [fromField]: this.from }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(`Twilio SMS xato: ${res.status} ${JSON.stringify(body)}`);
      }
      this.logger.log(`SMS yuborildi: ${phone} (sid: ${body?.sid ?? '?'}, status: ${body?.status ?? '?'})`);
    } catch (error) {
      this.logger.error(`SMS yuborishda XATOLIK (${phone}): ${(error as Error).message}`);
      // Fall back to logging the code so testing can continue even if the
      // real send failed (e.g. unverified recipient on a trial account,
      // wrong credentials, network).
      this.logger.log(`[SMS TASDIQLASH KODI] ${phone} -> ${code}`);
    }
  }
}
