// Shared by the password forms (live feedback) and the server actions (the real check).
// The rules are set by admins (Admin › Venues › Password rules; platform_settings, read through public.site_flags()).
// Leaked passwords: checked live in the browser (components/auth/password-meter.tsx, via /api/password-check)
// and again on the server before saving (lib/auth/pwned.ts), when that rule is on. Turn on Supabase "Leaked password
// protection" (Pro plan) to have Auth refuse them too.
const COMMON = ["password", "12345678", "qwerty", "letmein", "plenary", "conference", "iloveyou", "welcome", "admin", "abc123"];

export type PasswordMix = "none" | "letters_number" | "three_kinds";
export type PasswordPolicy = {
  /** Shortest password allowed (6–64). */
  minLength: number;
  /** What it must contain: nothing more, letters and a number, or 3 of lowercase/uppercase/number/symbol. */
  mix: PasswordMix;
  /** A password at least this long needs no mix (0 = no such exception). */
  phraseLength: number;
  /** Refuse passwords found in known data leaks. */
  checkLeaks: boolean;
};
export const DEFAULT_POLICY: PasswordPolicy = { minLength: 8, mix: "letters_number", phraseLength: 12, checkLeaks: true };

export function parsePolicy(raw: Record<string, unknown> | null | undefined): PasswordPolicy {
  const r = raw ?? {};
  const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : d);
  const mix = r.pw_mix === "none" || r.pw_mix === "letters_number" || r.pw_mix === "three_kinds" ? r.pw_mix : DEFAULT_POLICY.mix;
  const minLength = num(r.pw_min_length, DEFAULT_POLICY.minLength, 6, 64);
  const phrase = num(r.pw_phrase_length, DEFAULT_POLICY.phraseLength, 0, 128);
  return { minLength, mix, phraseLength: phrase && phrase <= minLength ? 0 : phrase, checkLeaks: r.pw_check_leaks !== false };
}

/** The rule lines the forms show, in English (translated where shown). */
export function policyText(p: PasswordPolicy) {
  const mix = p.mix === "letters_number" ? "Letters and at least one number" : p.mix === "three_kinds" ? "Mix of letters, numbers and symbols" : null;
  const mixHint = p.mix === "three_kinds" ? "At least 3 of: lowercase, uppercase, number, symbol" : null;
  return {
    length: `At least ${p.minLength} characters`,
    mix,
    mixHint: [mixHint, p.phraseLength ? `Or a phrase of ${p.phraseLength}+ characters` : null].filter(Boolean).join(" — ") || undefined,
    summary: `At least ${p.minLength} characters${mix ? (p.mix === "letters_number" ? " with letters and a number" : " with a mix of letters, numbers and symbols") : ""}${mix && p.phraseLength ? ` — or a phrase of ${p.phraseLength}+ characters, which is easy to remember` : ""}.`,
  };
}

/**
 * The rules, each true when met:
 * long (minimum length), mixed (the required mix, or a phrase of phraseLength+), notCommon, notEmail,
 * different (from the current password, only when it is given). `ok` = all met and at most 128 characters.
 * `sc` 0–4 drives the strength bar: 3 = all rules met, 4 = also long and varied.
 */
export function scorePassword(p: string, email = "", current?: string, policy: PasswordPolicy = DEFAULT_POLICY) {
  const lower = p.toLowerCase();
  const long = p.length >= policy.minLength;
  const notCommon = p.length > 0 && !COMMON.some((c) => lower.includes(c));
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const parts = local.split(/[._+-]/).filter((x) => x.length >= 3);
  const notEmail = p.length > 0 && !(local.length >= 3 && lower.includes(local)) && !parts.some((x) => lower.includes(x));
  const kinds = { lower: /[a-z]/.test(p), upper: /[A-Z]/.test(p), number: /[0-9]/.test(p), symbol: /[^A-Za-z0-9]/.test(p) };
  const variety = Object.values(kinds).filter(Boolean).length;
  const phrase = policy.phraseLength > 0 && p.length >= policy.phraseLength;
  const mixOk = policy.mix === "none" ? true : policy.mix === "letters_number" ? /[A-Za-z]/.test(p) && /[0-9]/.test(p) : variety >= 3;
  const mixed = p.length > 0 && (mixOk || phrase);
  const different = !current || p !== current;
  const rules = long && notCommon && notEmail && mixed;
  const strong = Math.max(policy.minLength + 6, 14);
  let sc = 0;
  if (p.length) sc = 1;
  if (p.length >= Math.min(6, policy.minLength) && variety >= 2) sc = 2;
  if (rules) sc = 3;
  if (rules && p.length >= strong && variety >= 2) sc = 4;
  if (!notCommon) sc = Math.min(sc, 1);
  return { sc, long, mixed, notCommon, notEmail, different, kinds, ok: rules && different && p.length <= 128 };
}

/** a.researcher@uni.edu -> a.r•••@uni.edu */
export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, Math.min(3, Math.max(1, local.length - 1)))}•••@${domain}`;
}
