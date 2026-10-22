/**
 * Number of boxes on the email-code screens. Supabase sends 6–10 digit codes (Auth › Email › "Email OTP length");
 * set NEXT_PUBLIC_AUTH_CODE_LENGTH to the same value. The screens also accept any 6–10 digit code typed or pasted,
 * so a mismatch never blocks anyone.
 */
// Plenary uses 6-digit email codes: Supabase › Authentication › Email › "Email OTP length" must be 6.
// The screens also grow by themselves if a longer code is typed or pasted.
const n = Number(process.env.NEXT_PUBLIC_AUTH_CODE_LENGTH ?? 6);
export const EMAIL_CODE_LENGTH = Number.isInteger(n) && n >= 6 && n <= 10 ? n : 6;
export const EMAIL_CODE_MAX = 10;
export const EMAIL_CODE_MIN = 6;
