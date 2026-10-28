import "server-only";
import { createClient } from "@/lib/supabase/server";
import { expiresIn, sign, signingReady } from "@/lib/auth/signing";

/** PIN: "1024", "PIN 1024", "#1024" → "1024" (a number from 1000 up, 4 to 9 digits); anything else → null. */
export function normalizePlenaryId(raw: string): string | null {
  const t = (raw || "").trim().replace(/^(pin)?[\s:#-]*/i, "");
  return /^[1-9]\d{3,8}$/.test(t) ? t : null;
}

export const plenaryIdSignIn = () => signingReady();

/** Login alias: a name the person chose, like "jdoe" or "m.rossi" (3–32 characters, starts with a letter). */
export const ALIAS_RE = /^[a-z][a-z0-9._-]{2,31}$/;
export function normalizeAlias(raw: string): string | null {
  const t = (raw || "").trim().toLowerCase();
  return ALIAS_RE.test(t) && !/^pin[\s:#-]*\d/.test(t) ? t : null;
}

/** The sign-in email of a login alias, or null (signed request, same rules as a PIN). */
export async function emailForAlias(alias: string): Promise<string | null> {
  if (!signingReady()) return null;
  const exp = expiresIn(5);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("email_for_login_alias", { p_alias: alias, p_expires: exp, p_sig: sign(`alias|${alias}`, exp) });
  if (error || typeof data !== "string" || !data) return null;
  return data.toLowerCase();
}

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
 * What a sign-in form field holds → the account email. An email is used as typed; a PIN or a login alias is
 * looked up server-side. `id` is set (the PIN, or the alias in lower case) when the person typed one of those.
 */
export async function accountEmailFor(identifier: string): Promise<{ email: string | null; id: string | null }> {
  const t = (identifier || "").trim();
  if (t.indexOf("@") > 0) return { email: t.toLowerCase(), id: null };
  const pid = normalizePlenaryId(t);
  if (pid) return { email: await emailForPlenaryId(pid), id: pid };
  const alias = normalizeAlias(t);
  if (alias) return { email: await emailForAlias(alias), id: alias };
  return { email: null, id: null };
}
