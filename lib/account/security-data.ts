import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signingReady } from "@/lib/auth/signing";

export type EmailRow = { email: string; primary: boolean; verified: boolean };
export type FactorRow = { id: string; name: string; verified: boolean; createdAt: string };
export type SecurityPlus = {
  emails: EmailRow[];
  factors: FactorRow[];
  /** "aal1" | "aal2" for this session */
  level: string | null;
  /** set when the person asked to change their sign-in email and hasn't confirmed both links yet */
  pendingEmail: string | null;
  /** extra emails need PLENARY_SIGNING_SECRET */
  extraEmailsReady: boolean;
};

/** ST02 extras: the person's email addresses, authenticator apps and this session's sign-in level. */
export async function getSecurityPlus(): Promise<SecurityPlus | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: person } = await supabase.from("persons").select("id").eq("user_id", auth.user.id).maybeSingle();
  const [{ data: rows }, factors, aal] = await Promise.all([
    person ? supabase.from("person_emails").select("email, is_primary, verified_at").eq("person_id", person.id) : Promise.resolve({ data: [] }),
    supabase.auth.mfa.listFactors().catch(() => ({ data: null })),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().catch(() => ({ data: null })),
  ]);
  const emails = ((rows ?? []) as { email: string; is_primary: boolean; verified_at: string | null }[])
    .map((r) => ({ email: String(r.email), primary: r.is_primary, verified: !!r.verified_at }))
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.email.localeCompare(b.email));
  const signIn = (auth.user.email ?? "").toLowerCase();
  if (signIn && !emails.some((e) => e.email.toLowerCase() === signIn)) emails.unshift({ email: signIn, primary: true, verified: true });
  const list = (factors.data?.all ?? []) as { id: string; friendly_name?: string; factor_type: string; status: string; created_at: string }[];
  return {
    emails,
    factors: list.filter((f) => f.factor_type === "totp").map((f) => ({ id: f.id, name: f.friendly_name || "Authenticator app", verified: f.status === "verified", createdAt: f.created_at })),
    level: aal.data?.currentLevel ?? null,
    pendingEmail: (auth.user as { new_email?: string }).new_email ?? null,
    extraEmailsReady: signingReady(),
  };
}
