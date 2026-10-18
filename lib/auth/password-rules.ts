// Shared by the PR11 form (live feedback) and the server action (the real check).
// TODO(auth): also check Have I Been Pwned (k-anonymity range API) and turn on
// Supabase "Leaked password protection" (Pro plan) so leaked passwords are refused server-side too.
const COMMON = ["password", "12345678", "qwerty", "letmein", "plenary", "conference", "iloveyou", "welcome", "admin", "abc123"];

export const MIN_PASSWORD = 12;

export function scorePassword(p: string, email = "") {
  const lower = p.toLowerCase();
  const long = p.length >= MIN_PASSWORD;
  const notCommon = p.length > 0 && !COMMON.some((c) => lower.includes(c));
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const parts = local.split(/[._+-]/).filter((x) => x.length >= 3);
  const notEmail = p.length > 0 && !(local.length >= 3 && lower.includes(local)) && !parts.some((x) => lower.includes(x));
  const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9\s]/, /\s/].filter((r) => r.test(p)).length;
  let sc = 0;
  if (p.length) sc = 1;
  if (p.length >= 8) sc = 2;
  if (long && notCommon) sc = 3;
  if (long && notCommon && (p.length >= 16 || variety >= 3)) sc = 4;
  if (!notCommon) sc = Math.min(sc, 1);
  return { sc, long, notCommon, notEmail, ok: long && notCommon && notEmail && p.length <= 128 };
}

/** a.researcher@uni.edu -> a.r•••@uni.edu */
export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, Math.min(3, Math.max(1, local.length - 1)))}•••@${domain}`;
}
