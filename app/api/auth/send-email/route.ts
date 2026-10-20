import { createHmac, timingSafeEqual } from "node:crypto";
import { sendEmail } from "@/lib/email/send";
import { authMail } from "@/lib/email/auth-mail";
import { absoluteUrl, safeNext, site } from "@/lib/config/site";

/*
 * Supabase Auth "Send Email" hook: Supabase hands every auth email (sign-in code, sign-up, reset, invite,
 * email change) to this route; Plenary sends it through Resend with the 6-digit code AND a button.
 * The button always points at this site (/auth/confirm with a token hash), whatever Supabase's Site URL is.
 * Setup: Supabase → Authentication → Hooks → Send Email → HTTPS → <site>/api/auth/send-email,
 * then put the generated secret ("v1,whsec_…") in Vercel as SEND_EMAIL_HOOK_SECRET.
 */

type Payload = {
  user: { email: string; new_email?: string; user_metadata?: { given_name?: string } };
  email_data: { token?: string; token_hash?: string; redirect_to?: string; email_action_type: string; site_url?: string; token_new?: string; token_hash_new?: string };
};

// Standard Webhooks signature (what Supabase uses for HTTP hooks).
function verify(raw: string, h: Headers, secret: string): boolean {
  const id = h.get("webhook-id"), ts = h.get("webhook-timestamp"), sig = h.get("webhook-signature");
  if (!id || !ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest();
  return sig.split(" ").some((part) => {
    const b = Buffer.from(part.split(",")[1] ?? "", "base64");
    return b.length === expected.length && timingSafeEqual(b, expected);
  });
}

const fail = (status: number, message: string) => Response.json({ error: { http_code: status, message } }, { status });

/** Where to go after the button: the "next" Plenary asked for, if any. */
function nextFrom(redirectTo: string | undefined): string {
  if (!redirectTo) return "/workspace";
  try {
    const u = new URL(redirectTo);
    return safeNext(u.searchParams.get("next") ?? (u.pathname.startsWith("/auth/") ? "/workspace" : u.pathname));
  } catch { return "/workspace"; }
}

function confirmLink(hash: string | undefined, type: string, next: string) {
  if (!hash) return null;
  const u = new URL(absoluteUrl("/auth/confirm"));
  u.searchParams.set("token_hash", hash);
  u.searchParams.set("type", type);
  u.searchParams.set("next", next);
  return u.toString();
}

export async function POST(req: Request) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) return fail(503, "Send Email hook secret not configured");
  const raw = await req.text();
  if (!verify(raw, req.headers, secret)) return fail(401, "Bad signature");
  let p: Payload;
  try { p = JSON.parse(raw); } catch { return fail(400, "Bad payload"); }
  const d = p.email_data;
  const action = d.email_action_type;
  const next = nextFrom(d.redirect_to);
  // token_hash type for verifyOtp: links use the same names Supabase does.
  const linkType = action === "magiclink" || action === "email" ? "email" : action;

  const mails: { to: string; code: string | null; link: string | null }[] = [];
  if (action === "email_change") {
    // Secure email change: one email to the current address, one to the new address.
    if (d.token_hash) mails.push({ to: p.user.email, code: d.token ?? null, link: confirmLink(d.token_hash, "email_change", "/settings/security") });
    if (p.user.new_email && d.token_hash_new) mails.push({ to: p.user.new_email, code: d.token_new ?? null, link: confirmLink(d.token_hash_new, "email_change", "/settings/security") });
  } else if (action === "reauthentication") {
    mails.push({ to: p.user.email, code: d.token ?? null, link: null });
  } else {
    mails.push({ to: p.user.email, code: action === "invite" ? null : d.token ?? null, link: confirmLink(d.token_hash, linkType, action === "recovery" ? "/reset-password" : next) });
  }

  const host = new URL(absoluteUrl("/")).host;
  const continueTo = /^\/(venues|submit|program)\//.test(next) ? `${host}${next}` : null;
  for (const m of mails) {
    const { subject, html, text } = authMail({ action, code: m.code, link: m.link, to: m.to, name: p.user.user_metadata?.given_name ?? null, minutes: 60, continueTo, siteHost: host });
    const r = await sendEmail({ to: m.to, from: site.email.authFrom, subject, html, text });
    if (!r.ok) return fail(500, r.skipped ? "RESEND_API_KEY not configured" : `Email not sent: ${r.error}`);
  }
  return Response.json({});
}
