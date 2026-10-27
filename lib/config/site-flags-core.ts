/** Site switches: the shape and parser, shared by server pages and proxy.ts (see lib/config/site-flags.ts). */
export type SiteFlags = { homeEvent: string | null; singleEvent: boolean; signinEmailCode: boolean; signupEmailCode: boolean };
export const DEFAULT_FLAGS: SiteFlags = { homeEvent: null, singleEvent: false, signinEmailCode: true, signupEmailCode: true };

export function parseFlags(raw: unknown): SiteFlags {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    homeEvent: typeof r.home_event === "string" && /^[a-z0-9-]{2,80}$/.test(r.home_event) ? r.home_event : null,
    singleEvent: r.single_event === true,
    signinEmailCode: r.signin_email_code !== false,
    signupEmailCode: r.signup_email_code !== false,
  };
}
