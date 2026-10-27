import "server-only";
import { createClient } from "@/lib/supabase/server";
import { expiresIn, sign, signingReady } from "@/lib/auth/signing";

/** PIN: "1024", "PIN 1024", "#1024" → "1024" (a number from 1000 up, 4 to 9 digits); anything else → null. */
export function normalizePlenaryId(raw: string): string | null {
  const t = (raw || "").trim().replace(/^(pin)?[\s:#-]*/i, "");
  return /^[1-9]\d{3,8}$/.test(t) ? t : null;
}

export const plenaryIdSignIn = () => signingReady();

/**
 * The sign-in email of a PIN, or null. The database answers only requests this server signed,
 * so nobody can harvest emails by calling it directly. Callers must answer the same way whether or not it exists.
 */
export async function emailForPlenaryId(pid: string): Promise<string | null> {
  if (!signingReady()) return null;
  const exp = expiresIn(5);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("email_for_plenary_id", { p_plenary_id: pid, p_expires: exp, p_sig: sign(`pid|${pid}`, exp) });
  if (error || typeof data !== "string" || !data) return null;
  return data.toLowerCase();
}

/** "nassim@gmail.com" → "n•••@gmail.com" */
export function maskEmail(email: string): string {
  const [u, d] = email.split("@");
  if (!d) return "•••";
  return `${u.slice(0, 1)}•••@${d}`;
}

/**
 * What a sign-in form field holds → the account email. An email is used as typed; a PIN is
 * looked up server-side. `id` is set when the person typed a PIN.
 */
export async function accountEmailFor(identifier: string): Promise<{ email: string | null; id: string | null }> {
  const t = (identifier || "").trim();
  if (t.indexOf("@") > 0) return { email: t.toLowerCase(), id: null };
  const pid = normalizePlenaryId(t);
  if (!pid) return { email: null, id: null };
  return { email: await emailForPlenaryId(pid), id: pid };
}
