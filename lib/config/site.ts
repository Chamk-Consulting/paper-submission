// Single place for everything that depends on the product domain.
// When the domain is bought: set NEXT_PUBLIC_SITE_URL, EMAIL_FROM_AUTH, EMAIL_FROM_EVENTS and
// SUPPORT_EMAIL in Vercel (production + staging). Nothing else in the code names the domain.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const site = {
  name: "Plenary",
  // NEXT_PUBLIC_SITE_URL once the domain exists; until then the Vercel URL or localhost.
  url: (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ).replace(/\/$/, ""),
  email: {
    // Set EMAIL_FROM_AUTH / EMAIL_FROM_EVENTS to addresses on a domain verified in Resend.
    authFrom: process.env.EMAIL_FROM_AUTH ?? "Plenary <onboarding@resend.dev>",
    eventsFrom: process.env.EMAIL_FROM_EVENTS ?? "Plenary <onboarding@resend.dev>",
  },
  // Legal entity for footers and legal pages.
  legalName: "Chamk Consulting",
  /** Support address for help, legal and account pages: SUPPORT_EMAIL, or NEXT_PUBLIC_SUPPORT_EMAIL (also used by browser code). */
  supportEmail: process.env.SUPPORT_EMAIL?.trim() || process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null,
} as const;

/** Domain the sign-in emails come from (for "ask IT to allow mail from …"), read from the auth sender. */
export function senderDomain(): string {
  const m = site.email.authFrom.match(/@([^>\s]+)/);
  return m ? m[1] : "[sender domain]";
}

/** The support address, or a visible placeholder until SUPPORT_EMAIL is set. */
export function supportAddress(): { email: string | null; label: string } {
  return { email: site.supportEmail, label: site.supportEmail ?? "[support address]" };
}

export const supabaseEnv = {
  url: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  publishableKey: () =>
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
};

/** Absolute URL for links that leave the app (emails, OAuth redirects). */
export function absoluteUrl(path: string): string {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Only allow same-site relative paths as post-login destinations (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/workspace"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
