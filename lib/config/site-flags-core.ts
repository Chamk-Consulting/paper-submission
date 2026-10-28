/** Site switches: the shape and parser, shared by server pages and proxy.ts (see lib/config/site-flags.ts). */
export type SiteFlags = {
  homeEvent: string | null; singleEvent: boolean; signinEmailCode: boolean; signupEmailCode: boolean;
  /** Ways in offered on the sign-in page. Defaults: password, email code/link and ORCID on; the rest off. */
  signinPassword: boolean; signinPasskey: boolean; signinOrcid: boolean; signinInstitution: boolean; signinGoogle: boolean;
  /** Language picker and other languages (on by default). Off: English only, no picker. */
  languages: boolean;
};
export const DEFAULT_FLAGS: SiteFlags = {
  homeEvent: null, singleEvent: false, signinEmailCode: true, signupEmailCode: true,
  signinPassword: true, signinPasskey: false, signinOrcid: true, signinInstitution: false, signinGoogle: false,
  languages: true,
};

export function parseFlags(raw: unknown): SiteFlags {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const flag = (k: string, d: boolean) => (typeof r[k] === "boolean" ? (r[k] as boolean) : d);
  const f: SiteFlags = {
    homeEvent: typeof r.home_event === "string" && /^[a-z0-9-]{2,80}$/.test(r.home_event) ? r.home_event : null,
    singleEvent: r.single_event === true,
    signinEmailCode: flag("signin_email_code", true),
    signupEmailCode: flag("signup_email_code", true),
    signinPassword: flag("signin_password", true),
    signinPasskey: flag("signin_passkey", false),
    signinOrcid: flag("signin_orcid", true),
    signinInstitution: flag("signin_institution", false),
    signinGoogle: flag("signin_google", false),
    languages: flag("languages", true),
  };
  // Someone must always be able to get in.
  if (!f.signinPassword && !f.signinEmailCode) f.signinPassword = true;
  return f;
}
