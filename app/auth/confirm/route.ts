import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/config/site";

// Handles every email link: sign-up confirmation, password recovery, magic link, email change.
// Supabase email templates must point here:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<signup|recovery|magiclink|email_change>&next=...
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const dest = type === "recovery" ? "/reset-password" : type === "signup" ? "/create-account/profile" : next;
      return NextResponse.redirect(new URL(dest, origin));
    }
  } else if (code) {
    // PKCE flow (default links and OAuth)
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  return NextResponse.redirect(new URL("/auth-error?reason=link", origin));
}
