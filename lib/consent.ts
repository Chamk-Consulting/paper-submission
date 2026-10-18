/**
 * Cookie consent (GDPR / ePrivacy). Shared by the proxy (server) and the browser.
 *
 * Categories
 *  - necessary   — always on: sign-in session (Supabase), password-reset step, this consent record,
 *                  the offline copy of public pages. No consent needed, but listed for transparency.
 *  - preferences — remembering your language on this device and small "don't show again" choices.
 *
 * There are no advertising or analytics cookies. To add a category later: extend Consent + CATEGORIES,
 * bump CONSENT_VERSION (everyone is asked again), and gate the feature with hasConsent().
 */
export const CONSENT_COOKIE = "pl_consent";
export const CONSENT_VERSION = 1;
/** Ask again after 6 months (CNIL recommendation). */
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 182;

export type ConsentCategory = "necessary" | "preferences";
export type Consent = { v: number; preferences: boolean; at: string };

export const CATEGORIES: { key: ConsentCategory; title: string; body: string; required?: boolean }[] = [
  {
    key: "necessary",
    title: "Strictly necessary",
    body: "Keep you signed in, protect password resets, remember this choice and keep public pages readable offline. The service doesn’t work without them.",
    required: true,
  },
  {
    key: "preferences",
    title: "Preferences",
    body: "Remember your language and small choices such as “don’t show this again” on this device. Without them, your language lasts until you close the browser.",
  },
];

export function parseConsent(raw: string | null | undefined): Consent | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(decodeURIComponent(raw)) as Partial<Consent>;
    if (c.v !== CONSENT_VERSION || typeof c.preferences !== "boolean") return null;
    return { v: c.v, preferences: c.preferences, at: String(c.at ?? "") };
  } catch {
    return null;
  }
}

export function serializeConsent(c: Omit<Consent, "v" | "at">): string {
  return encodeURIComponent(JSON.stringify({ v: CONSENT_VERSION, preferences: c.preferences, at: new Date().toISOString() }));
}
