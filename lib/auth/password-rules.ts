// Shared by the password forms (live feedback) and the server actions (the real check).
// Leaked passwords: checked live in the browser (components/auth/password-meter.tsx, via /api/password-check)
// and again on the server before saving (lib/auth/pwned.ts). Turn on Supabase "Leaked password protection"
// (Pro plan) to have Auth refuse them too.
const COMMON = ["password", "12345678", "qwerty", "letmein", "plenary", "conference", "iloveyou", "welcome", "admin", "abc123"];

export const MIN_PASSWORD = 8;
/** A passphrase this long needs no number. */
export const PASSPHRASE = 12;

/**
 * The rules, each true when met:
 * long (8+), mixed (letters and a number, or 12+ characters), notCommon, notEmail,
 * different (from the current password, only when it is given). `ok` = all met and at most 128 characters.
 * `sc` 0–4 drives the strength bar: 3 = all rules met, 4 = also long and varied.
 */
export function scorePassword(p: string, email = "", current?: string) {
  const lower = p.toLowerCase();
  const long = p.length >= MIN_PASSWORD;
  const notCommon = p.length > 0 && !COMMON.some((c) => lower.includes(c));
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const parts = local.split(/[._+-]/).filter((x) => x.length >= 3);
  const notEmail = p.length > 0 && !(local.length >= 3 && lower.includes(local)) && !parts.some((x) => lower.includes(x));
  const kinds = { lower: /[a-z]/.test(p), upper: /[A-Z]/.test(p), number: /[0-9]/.test(p), symbol: /[^A-Za-z0-9]/.test(p) };
  const variety = Object.values(kinds).filter(Boolean).length;
  const mixed = p.length > 0 && ((/[A-Za-z]/.test(p) && /[0-9]/.test(p)) || p.length >= PASSPHRASE);
  const different = !current || p !== current;
  const rules = long && notCommon && notEmail && mixed;
  let sc = 0;
  if (p.length) sc = 1;
  if (p.length >= 6 && variety >= 2) sc = 2;
  if (rules) sc = 3;
  if (rules && ((p.length >= PASSPHRASE && variety >= 3) || p.length >= 16)) sc = 4;
  if (!notCommon) sc = Math.min(sc, 1);
  return { sc, long, mixed, notCommon, notEmail, different, kinds, ok: rules && different && p.length <= 128 };
}

/** a.researcher@uni.edu -> a.r•••@uni.edu */
export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, Math.min(3, Math.max(1, local.length - 1)))}•••@${domain}`;
}
