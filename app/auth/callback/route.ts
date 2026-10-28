import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordSignIn } from "@/lib/auth/sign-in-log";
import { safeNext } from "@/lib/config/site";
import { expiresIn, sign } from "@/lib/auth/signing";

const VIA = new Set(["orcid", "google", "sso", "link"]);

// OAuth / SSO return (ORCID, Google, institution SSO), and ORCID connect from account settings (?via=link).
// Register this URL with each provider via Supabase.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const via = VIA.has(searchParams.get("via") ?? "") ? (searchParams.get("via") as string) : "orcid";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // ORCID gives no email: a new user with no email is an ORCID iD nobody has connected yet.
      if (via !== "link" && !data.user.email) {
        await supabase.auth.signOut();
        const exp = expiresIn(10);
        await supabase.rpc("discard_unlinked_oauth_user", { p_user: data.user.id, p_expires: exp, p_sig: sign(`oauth-unlinked|${data.user.id}`, exp) });
        return NextResponse.redirect(new URL(`/sign-in?error=${via === "orcid" ? "orcid_unlinked" : "oauth_no_email"}`, origin));
      }
      if (via !== "link") await recordSignIn(supabase, via === "sso" ? "sso" : (via as "orcid" | "google"));
      return NextResponse.redirect(new URL(via === "link" ? next : `/auth/continue?next=${encodeURIComponent(next)}`, origin));
    }
  }
  const err = searchParams.get("error_description") ?? "";
  if (via === "link") return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}orcid=failed`, origin));
  return NextResponse.redirect(new URL(`/sign-in?error=${/provider is not enabled|Unsupported provider/i.test(err) ? "provider_off" : "oauth"}`, origin));
}
