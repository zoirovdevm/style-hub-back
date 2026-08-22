// Shared Uzbekistan phone helpers — used by every auth DTO/service that
// takes a phone number, so the format rule and normalization logic live in
// exactly one place instead of being copy-pasted (and drifting) across
// register/login/forgot-password.
//
// IMPORTANT (per product spec): this regex only checks the *shape* of the
// number (+998 followed by exactly 9 digits). It intentionally cannot and
// does not prove the number is real or actually reachable — that's what the
// SMS OTP step is for.
export const UZ_PHONE_REGEX = /^\+998\d{9}$/;

// Strips everything except digits and a leading "+", so "+998 (90) 123-45-67"
// and "+998901234567" both normalize to the same stored/looked-up value.
export function normalizePhoneValue(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[^\d+]/g, '') : (value as string);
}
