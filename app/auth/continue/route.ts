import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/config/site";
import { refuseIfLocked } from "@/lib/auth/lock-check";
import { resolveOnboarding, stepHref } from "@/lib/auth/onboarding";
import { START_HREF, parseUi } from "@/lib/account/ui-prefs";

/*
 * Every successful way in ends here (plan B5): password, email code, email link, reset, two-step, sign-up code.
 * It opens the first unfinished step (confirm → two-step → password → profile) and otherwise goes on to `next`.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const supabase = await createClient();
  const r = await resolveOnboarding(supabase);
  if (!r.user) return NextResponse.redirect(new URL(`/sign-in?next=${encodeURIComponent(next)}`, origin));
  if (await refuseIfLocked(supabase)) return NextResponse.redirect(new URL("/auth-error?reason=locked", origin));
  // Settings › Preferences › Start page: only when no particular page was asked for.
  let to = next;
  if (r.step === "done" && next === "/workspace") {
    const { data: me } = await supabase.rpc("my_person");
    to = START_HREF[parseUi((me as { ui_prefs?: unknown } | null)?.ui_prefs).start];
  }
  const res = NextResponse.redirect(new URL(stepHref(r.step, to, { ref: r.ref, email: r.user.email }), origin));
  res.headers.set("cache-control", "no-store");
  return res;
}
