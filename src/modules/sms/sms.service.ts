import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// "SMS Gateway for Android" (https://sms-gate.app,
// github.com/capcom6/android-sms-gateway) — sends SMS through YOUR OWN
// phone's own SIM/number instead of any third-party SMS API. This is the
// primary/preferred provider now (tried before Eskiz/Twilio below), since
// the whole point of wiring it up was to stop depending on a third party
// to send codes.
//
// Setup, Local Server mode (phone and this backend must be on the SAME
// local network, e.g. same Wi-Fi/router):
//   1. Install "SMS Gateway for Android" on the phone (Play Store/F-Droid).
//   2. In the app, turn ON "Local Server" and tap the status button to go
//      online — it then shows the phone's local IP (e.g. 192.168.1.50), a
//      port (default 8080), and a username/password for Basic Auth.
//   3. In .env set SMS_GATEWAY_BASE_URL to "http://<that local ip>:8080"
//      and SMS_GATEWAY_USERNAME/SMS_GATEWAY_PASSWORD to the credentials
//      shown in the app.
// Sending: POST {baseUrl}/message, HTTP Basic Auth, JSON body
//   { "textMessage": { "text": "..." }, "phoneNumbers": ["+998901234567"] }
//   -> { id, state, ... }
// No delivery-status polling is done here — a non-2xx response (or a
// network error, e.g. the phone is off Wi-Fi or the app went offline) is
// treated as a failed send and falls through the same way Eskiz/Twilio do
// below, so registration/testing can still continue.

// Eskiz.uz (https://notify.eskiz.uz) — the standard SMS gateway for
// Uzbekistan numbers. Auth is email+password (NOT a public/private
// keypair) exchanged for a Bearer token:
//   POST /auth/login  (multipart/form-data: email, password)
//     -> { message, data: { token }, token_type }
// That token is long-lived (documented as ~30 days) and is cached in
// memory here; sendSms() re-authenticates from scratch whenever there's no
// cached token yet, and again — once — if a send comes back 401/403,
// rather than tracking the exact expiry.
//
// Sending:
//   POST /message/sms/send  (multipart/form-data: mobile_phone, message,
//   from, callback_url?), Authorization: Bearer <token>
// `mobile_phone` is digits only, no leading "+" (e.g. "998901234567").
// `from` is a sender nickname — Eskiz's shared "4546" nickname works
// immediately for testing; a custom nickname needs approval from Eskiz
// support first. New/unverified Eskiz accounts are commonly restricted to
// sending only the exact text "Bu Eskiz dan test" (or a verified test
// number) until the account itself is approved — if sends fail with an
// account/message-not-allowed error, that's the first thing to check in
// the Eskiz dashboard.
const ESKIZ_BASE_URL = 'https://notify.eskiz.uz/api';

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

  private readonly gatewayBaseUrl: string;
  private readonly gatewayUsername: string;
  private readonly gatewayPassword: string;

  private readonly eskizEmail: string;
  private readonly eskizPassword: string;
  private readonly eskizFrom: string;
  private eskizToken: string | null = null;
  // Serializes concurrent logins — without this, two SMS sends racing at
  // startup (e.g. two OTP requests) would each fire their own /auth/login
  // call instead of the second one reusing the first's in-flight result.
  private eskizLoginPromise: Promise<string> | null = null;

  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.gatewayBaseUrl = (this.config.get<string>('sms.gatewayBaseUrl') ?? '').replace(/\/+$/, '');
    this.gatewayUsername = this.config.get<string>('sms.gatewayUsername') ?? '';
    this.gatewayPassword = this.config.get<string>('sms.gatewayPassword') ?? '';

    this.eskizEmail = this.config.get<string>('sms.eskizEmail') ?? '';
    this.eskizPassword = this.config.get<string>('sms.eskizPassword') ?? '';
    this.eskizFrom = this.config.get<string>('sms.eskizFrom') ?? '4546';

    this.accountSid = this.config.get<string>('sms.accountSid') ?? '';
    this.authToken = this.config.get<string>('sms.authToken') ?? '';
    this.from = this.config.get<string>('sms.from') ?? '';

    if (!this.gatewayConfigured && !this.eskizConfigured && !this.twilioConfigured) {
      this.logger.warn(
        'SMS provider sozlanmagan (.env dagi SMS_GATEWAY_* / ESKIZ_EMAIL+ESKIZ_PASSWORD / TWILIO_ACCOUNT_SID+TWILIO_AUTH_TOKEN+TWILIO_FROM bo‘sh) — tasdiqlash kodlari konsolga chiqariladi.',
      );
    }
  }

  private get gatewayConfigured() {
    return !!(this.gatewayBaseUrl && this.gatewayUsername && this.gatewayPassword);
  }

  private get eskizConfigured() {
    return !!(this.eskizEmail && this.eskizPassword);
  }

  private get twilioConfigured() {
    return !!(this.accountSid && this.authToken && this.from);
  }

  async sendVerificationCode(phone: string, code: string) {
    // Brand name leads, code trails at the end of a full sentence (rather
    // than a bare "Label: CODE" line) — a personal SIM's own-phone gateway
    // route (sendViaOwnGateway below) has no carrier-level "this sender is
    // an approved A2P source" status the way Eskiz/Twilio do, so recipients'
    // phones sometimes route these into Spam based on pattern-matching.
    // This wording won't reliably prevent that (it's the recipient's
    // phone/carrier doing the classifying, not anything under our control)
    // — the one real fix is the recipient marking a first message "Not
    // spam" once — but it's a small, free way to look less like a bare
    // OTP-spam template. Kept context-neutral (not "registration code"
    // specifically) since this one method also serves the forgot-password
    // SMS branch in auth.service.ts — a register OTP and a reset OTP share
    // this exact wording.
    const message = `Wardrobe: sizning tasdiqlash kodingiz — ${code}. Kodni hech kimga bermang.`;

    if (this.gatewayConfigured) {
      await this.sendViaOwnGateway(phone, code, message);
      return;
    }

    if (this.eskizConfigured) {
      await this.sendViaEskiz(phone, code, message);
      return;
    }

    if (this.twilioConfigured) {
      await this.sendViaTwilio(phone, code, message);
      return;
    }

    this.logger.log(`[SMS TASDIQLASH KODI] ${phone} -> ${code} (SMS provider sozlanmagani uchun SMS jo'natilmadi)`);
  }

  // ---- SMS Gateway for Android (own phone number, primary) ----------

  private async sendViaOwnGateway(phone: string, code: string, message: string) {
    try {
      // `phone` already arrives normalized as "+998901234567" (see
      // common/utils/phone.util.ts) — exactly the E.164 format the
      // gateway's `phoneNumbers` array expects, so no reformatting needed
      // here (unlike Eskiz/Twilio below).
      const auth = Buffer.from(`${this.gatewayUsername}:${this.gatewayPassword}`).toString('base64');

      const res = await fetch(`${this.gatewayBaseUrl}/message`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ textMessage: { text: message }, phoneNumbers: [phone] }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(`SMS Gateway xato: ${res.status} ${JSON.stringify(body)}`);
      }
      this.logger.log(`SMS yuborildi (o'z telefon raqamidan): ${phone} (id: ${body?.id ?? '?'}, holat: ${body?.state ?? '?'})`);
    } catch (error) {
      this.logger.error(
        `SMS yuborishda XATOLIK (SMS Gateway, ${phone}): ${(error as Error).message} — telefon Wi-Fi'da/ilova online ekanini tekshiring`,
      );
      // Fall back to logging the code so testing/registration can continue
      // even if the phone is offline, the app isn't running, or the local
      // IP in .env is stale.
      this.logger.log(`[SMS TASDIQLASH KODI] ${phone} -> ${code}`);
    }
  }

  // ---- Eskiz.uz (fallback provider) ----------------------------------

  private async eskizLogin(): Promise<string> {
    if (this.eskizLoginPromise) return this.eskizLoginPromise;

    this.eskizLoginPromise = (async () => {
      const form = new FormData();
      form.set('email', this.eskizEmail);
      form.set('password', this.eskizPassword);

      const res = await fetch(`${ESKIZ_BASE_URL}/auth/login`, { method: 'POST', body: form });
      const body = await res.json().catch(() => null);
      const token = body?.data?.token;
      if (!res.ok || !token) {
        throw new Error(`Eskiz login xato: ${res.status} ${JSON.stringify(body)}`);
      }
      this.eskizToken = token;
      return token as string;
    })();

    try {
      return await this.eskizLoginPromise;
    } finally {
      this.eskizLoginPromise = null;
    }
  }

  private async sendViaEskiz(phone: string, code: string, message: string) {
    try {
      let token = this.eskizToken ?? (await this.eskizLogin());
      // Eskiz wants digits only, no "+" (e.g. "998901234567").
      const mobilePhone = phone.replace(/\D/g, '');

      let res = await this.eskizSendRequest(token, mobilePhone, message);

      // Cached token expired/invalid — log in again once and retry, rather
      // than tracking the token's exact ~30-day expiry ourselves.
      if (res.status === 401 || res.status === 403) {
        this.eskizToken = null;
        token = await this.eskizLogin();
        res = await this.eskizSendRequest(token, mobilePhone, message);
      }

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(`Eskiz SMS xato: ${res.status} ${JSON.stringify(body)}`);
      }
      this.logger.log(`SMS yuborildi (Eskiz): ${phone} (id: ${body?.id ?? '?'}, status: ${body?.status ?? '?'})`);
    } catch (error) {
      this.logger.error(`SMS yuborishda XATOLIK (Eskiz, ${phone}): ${(error as Error).message}`);
      // Fall back to logging the code so testing/registration can continue
      // even if the real send failed (wrong credentials, account not yet
      // approved for this recipient/message, network issue, etc.).
      this.logger.log(`[SMS TASDIQLASH KODI] ${phone} -> ${code}`);
    }
  }

  private eskizSendRequest(token: string, mobilePhone: string, message: string) {
    const form = new FormData();
    form.set('mobile_phone', mobilePhone);
    form.set('message', message);
    form.set('from', this.eskizFrom);

    return fetch(`${ESKIZ_BASE_URL}/message/sms/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  }

  // ---- Twilio (fallback provider) ------------------------------------

  private async sendViaTwilio(phone: string, code: string, message: string) {
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
      this.logger.log(`SMS yuborildi (Twilio): ${phone} (sid: ${body?.sid ?? '?'}, status: ${body?.status ?? '?'})`);
    } catch (error) {
      this.logger.error(`SMS yuborishda XATOLIK (Twilio, ${phone}): ${(error as Error).message}`);
      // Fall back to logging the code so testing can continue even if the
      // real send failed (e.g. unverified recipient on a trial account,
      // wrong credentials, network).
      this.logger.log(`[SMS TASDIQLASH KODI] ${phone} -> ${code}`);
    }
  }
}
