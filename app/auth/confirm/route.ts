import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordSignIn } from "@/lib/auth/sign-in-log";
import { safeNext } from "@/lib/config/site";
import { markRecovery } from "@/lib/auth/recovery-cookie";
import { refuseIfLocked } from "@/lib/auth/lock-check";

// Handles every email link: sign-up confirmation, password recovery, magic link, email change.
// Links look like /auth/confirm?token_hash=…&type=<signup|recovery|magiclink|email|email_change|invite>&next=…
//
// The token in a link is single-use. Opening the link (GET) does NOT use it: mail scanners
// (Outlook Safe Links, Gmail/antivirus previews) open links before the person does, and a second
// click would otherwise show "expired". GET shows a one-button page; the button POSTs and only
// then is the token used. If the person is already signed in (link used once already), they go
// straight on instead of seeing an error.

const TYPES = new Set(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

function destFor(type: string, next: string) {
  return type === "recovery" ? "/reset-password" : type === "signup" ? "/create-account/profile" : next;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const COPY: Record<string, { kicker: string; title: string; lead: string; button: string }> = {
  signup: { kicker: "Confirm your email", title: "One last click", lead: "Confirm this email address to finish creating your Plenary account.", button: "Confirm my email" },
  invite: { kicker: "Invitation", title: "Accept your invitation", lead: "Confirm this email address to join Plenary.", button: "Accept and continue" },
  magiclink: { kicker: "Sign in", title: "Sign in to Plenary", lead: "Continue to sign in on this device.", button: "Sign in to Plenary" },
  email: { kicker: "Sign in", title: "Sign in to Plenary", lead: "Continue to sign in on this device.", button: "Sign in to Plenary" },
  recovery: { kicker: "Reset password", title: "Choose a new password", lead: "Continue to set a new password for your Plenary account.", button: "Continue to reset" },
  email_change: { kicker: "Change email", title: "Confirm your new email", lead: "Confirm this change to your Plenary account email.", button: "Confirm the change" },
};

function page(tokenHash: string, type: string, next: string) {
  const c = COPY[type] ?? COPY.email;
  const sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const mono = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta name="referrer" content="no-referrer"><title>${esc(c.title)} · Plenary</title></head>
<body style="margin:0;min-height:100vh;background:#EEF0EC;font:16px/1.55 ${sans};color:#121826">
<main style="max-width:480px;margin:0 auto;padding:56px 16px">
<div style="background:#fff;border:1px solid #DADDE3;border-radius:10px;padding:32px 28px">
<p style="margin:0;font:22px/1 Georgia,'Times New Roman',serif">Plenary</p>
<p style="margin:24px 0 0;font:500 11px/1.4 ${mono};letter-spacing:.08em;text-transform:uppercase;color:#18744F">${esc(c.kicker)}</p>
<h1 style="margin:6px 0 0;font:400 30px/1.15 Georgia,'Times New Roman',serif">${esc(c.title)}</h1>
<p style="margin:8px 0 0;color:#4A5263">${esc(c.lead)}</p>
<form method="post" action="/auth/confirm" style="margin:24px 0 0">
<input type="hidden" name="token_hash" value="${esc(tokenHash)}"><input type="hidden" name="type" value="${esc(type)}"><input type="hidden" name="next" value="${esc(next)}">
<button type="submit" style="width:100%;height:48px;border:0;border-radius:4px;background:#F2A93B;color:#0E1B3D;font:700 16px/1 ${sans};cursor:pointer">${esc(c.button)}</button>
</form>
<p style="margin:16px 0 0;font-size:13px;color:#4A5263">This extra step stops email security scanners from using your one-time link before you do.</p>
</div></main></body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (tokenHash && type && TYPES.has(type)) {
    // Already signed in (this link was used a moment ago, or in another tab): just continue.
    if (type !== "recovery" && type !== "email_change") {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) return NextResponse.redirect(new URL(destFor(type, next), origin));
    }
    return page(tokenHash, type, next);
  }

  if (code) {
    // PKCE flow (default Supabase links and OAuth). Needs the verifier cookie from the same browser.
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (await refuseIfLocked(supabase)) return NextResponse.redirect(new URL("/auth-error?reason=locked", origin));
      await recordSignIn(supabase, "email_link");
      return NextResponse.redirect(new URL(next, origin));
    }
    const { data } = await supabase.auth.getUser();
    if (data.user) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/auth-error?reason=link", origin));
}

export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  const sentFrom = request.headers.get("origin");
  if (sentFrom && sentFrom !== origin) return NextResponse.redirect(new URL("/auth-error?reason=link", origin), 303);

  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "");
  const next = safeNext(String(form.get("next") ?? ""));
  if (!tokenHash || !TYPES.has(type)) return NextResponse.redirect(new URL("/auth-error?reason=link", origin), 303);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
  if (!error) {
    if (await refuseIfLocked(supabase)) return NextResponse.redirect(new URL("/auth-error?reason=locked", origin), 303);
    if (type === "recovery" && data.user) await markRecovery(data.user.id);
    if (type === "magiclink" || type === "email") await recordSignIn(supabase, "email_link");
    return NextResponse.redirect(new URL(destFor(type, next), origin), 303);
  }

  // Used already (double click, code typed first): if this browser is signed in, carry on.
  if (type !== "recovery") {
    const { data: me } = await supabase.auth.getUser();
    if (me.user) return NextResponse.redirect(new URL(destFor(type, next), origin), 303);
  }
  return NextResponse.redirect(new URL("/auth-error?reason=link", origin), 303);
}
