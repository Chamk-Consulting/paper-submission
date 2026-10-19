import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { JUST_SIGNED_IN_COOKIE, encodeAccount, maskEmail } from "@/lib/auth/device-accounts";

/**
 * After a successful sign-in, hand the account summary (name, masked email, Plenary ID) to the browser
 * so the sign-in page can offer "Welcome back" next time (PR03). Only with "preferences" consent;
 * the browser moves it into device storage and deletes the cookie (components/auth/remember-account.tsx).
 */
export async function rememberDevice(supabase: SupabaseClient) {
  try {
    const jar = await cookies();
    if (!parseConsent(jar.get(CONSENT_COOKIE)?.value ?? null)?.preferences) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;
    const { data: p } = await supabase.from("persons").select("given_name, family_name, paper_name, plenary_id").eq("user_id", user.id).maybeSingle();
    const full = [p?.given_name, p?.family_name].filter(Boolean).join(" ");
    const name = ((p?.paper_name as string) || full || user.email.split("@")[0]).slice(0, 160);
    jar.set(JUST_SIGNED_IN_COOKIE, encodeAccount({ name, email: maskEmail(user.email), id: (p?.plenary_id as string) ?? null, at: new Date().toISOString() }), {
      path: "/", maxAge: 600, sameSite: "lax", secure: process.env.NODE_ENV === "production", httpOnly: false,
    });
  } catch {
    /* optional convenience — never blocks signing in */
  }
}
