// Single place for everything that depends on the product domain.
// TODO(domain): when the domain is bought, set NEXT_PUBLIC_SITE_URL in Vercel
// (production + staging) and update the email sender addresses below.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const site = {
  name: "Plenary",
  // TODO(domain): e.g. https://plenaryapp.com — for now the Vercel URL or localhost.
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  email: {
    // TODO(domain): no-reply@<domain> and events@<domain> once the domain is verified in Resend.
    authFrom: process.env.EMAIL_FROM_AUTH ?? "Plenary <onboarding@resend.dev>",
    eventsFrom: process.env.EMAIL_FROM_EVENTS ?? "Plenary <onboarding@resend.dev>",
  },
  // TODO(domain): legal entity + contact address for footers and legal pages.
  legalName: "Chamk Consulting",
} as const;

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
