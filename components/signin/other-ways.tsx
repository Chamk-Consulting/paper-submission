"use client";
import { useState } from "react";
import { Fingerprint, Globe, Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { useT } from "@/lib/i18n/client";
import { notePasskeySignIn } from "@/lib/auth/passkey-actions";

export type SignInMethods = { password: boolean; passkey: boolean; orcid: boolean; institution: boolean; google: boolean };

const SECONDARY =
  "flex items-center justify-center gap-2 rounded-[4px] border border-[#B7BDC9] bg-white font-medium text-[#121826] hover:bg-[#F7F8F6] disabled:opacity-60";

export const OrcidIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden><circle cx="9" cy="9" r="8.5" fill="#A6CE39" /><text x="9" y="12.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="700" fill="#FFFFFF">iD</text></svg>
);

/** Where an OAuth / SSO sign-in comes back to (app/auth/callback). */
function callback(via: string, next?: string) {
  const q = new URLSearchParams({ via, next: next || "/workspace" });
  return `${window.location.origin}/auth/callback?${q}`;
}

/**
 * Passkey, ORCID, institution single sign-on and Google: each shows only when its switch is on
 * (Admin › Venues › Ways to sign in). Each needs the matching setting in Supabase Auth too.
 */
export function OtherWays({ methods, next, identifier, onMessage }: { methods: SignInMethods; next?: string; identifier: string; onMessage: (m: string | null) => void }) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const providers = [methods.orcid, methods.institution, methods.google].filter(Boolean).length;
  if (!methods.passkey && providers === 0) return null;

  const fail = (m: string) => { setBusy(null); onMessage(m); };

  async function passkey() {
    onMessage(null);
    setBusy("passkey");
    if (typeof window === "undefined" || !window.PublicKeyCredential) return fail(t("This browser can’t use passkeys. Sign in another way."));
    const { error } = await createClient().auth.signInWithPasskey();
    if (error) {
      const msg = String(error.message ?? "");
      if (/cancel|abort|NotAllowed/i.test(msg) || (error as { name?: string }).name === "WebAuthnError") return fail(t("No passkey was used. Try again, or sign in another way."));
      if (/disabled|not enabled/i.test(msg)) return fail(t("Passkey sign-in isn’t available yet. Sign in another way."));
      return fail(t("That passkey didn’t work. Sign in another way, then add a new passkey in your account."));
    }
    await notePasskeySignIn();
    window.location.assign(`/auth/continue?next=${encodeURIComponent(next || "/workspace")}`);
  }

  async function oauth(provider: "custom:orcid" | "google", via: "orcid" | "google") {
    onMessage(null);
    setBusy(via);
    const { error } = await createClient().auth.signInWithOAuth({ provider, options: { redirectTo: callback(via, next) } });
    if (error) fail(t("{what} sign-in isn’t available yet. Sign in another way.", { what: via === "orcid" ? "ORCID" : "Google" }));
  }

  async function institution() {
    onMessage(null);
    const domain = identifier.includes("@") ? identifier.split("@")[1].trim().toLowerCase() : "";
    if (!domain) return onMessage(t("Type your institution email above first, then choose Institution."));
    setBusy("sso");
    const { data, error } = await createClient().auth.signInWithSSO({ domain, options: { redirectTo: callback("sso", next) } });
    if (error || !data?.url) return fail(t("Your institution isn’t set up for single sign-on here. Sign in with your email."));
    window.location.assign(data.url);
  }

  const cols = providers >= 3 ? "grid-cols-3" : providers === 2 ? "grid-cols-2" : "grid-cols-1";
  return (
    <>
      <div className="my-[22px] flex items-center gap-3 text-[13px] text-[#4A5263]">
        <span className="h-px flex-auto bg-[#DADDE3]" />{t("or continue with")}<span className="h-px flex-auto bg-[#DADDE3]" />
      </div>
      {methods.passkey ? (
        <button type="button" onClick={passkey} disabled={!!busy} className={`mb-2 h-11 w-full text-[14px] ${SECONDARY}`}>
          <Fingerprint size={18} strokeWidth={1.75} aria-hidden />{busy === "passkey" ? t("Waiting for your passkey…") : t("Use a passkey")}
        </button>
      ) : null}
      {providers ? (
        <div className={`grid ${cols} gap-2`}>
          {methods.orcid ? <button type="button" onClick={() => oauth("custom:orcid", "orcid")} disabled={!!busy} className={`h-11 text-[14px] ${SECONDARY}`}><OrcidIcon />ORCID</button> : null}
          {methods.institution ? <button type="button" onClick={institution} disabled={!!busy} className={`h-11 text-[14px] ${SECONDARY}`}><Landmark size={18} strokeWidth={1.75} aria-hidden />{t("Institution")}</button> : null}
          {methods.google ? <button type="button" onClick={() => oauth("google", "google")} disabled={!!busy} className={`h-11 text-[14px] ${SECONDARY}`}><Globe size={18} strokeWidth={1.75} aria-hidden />Google</button> : null}
        </div>
      ) : null}
    </>
  );
}
