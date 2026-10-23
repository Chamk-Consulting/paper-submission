import { createClient } from "@/lib/supabase/server";
import { buildIcs, type IcsItem } from "@/lib/account/ics";
import { site } from "@/lib/config/site";

/* CL01 one-off download for the signed-in person: /feed/me?submissions=1&reviews=1&sessions=1&followed=0. Doesn't update later. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.redirect(new URL("/sign-in?next=/workspace/settings/calendar", request.url), 303);
  const q = new URL(request.url).searchParams;
  const on = (k: string, d: boolean) => (q.has(k) ? q.get(k) === "1" : d);
  const flags = { submissions: on("submissions", true), reviews: on("reviews", true), sessions: on("sessions", true), followed: on("followed", false) };
  const { data, error } = await supabase.rpc("my_calendar_items", { p_flags: flags });
  if (error) return new Response("Calendar unavailable", { status: 503 });
  const body = buildIcs((data ?? []) as IcsItem[], { name: "Plenary deadlines", origin: site.url, host: new URL(site.url).host });
  return new Response(body, {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'attachment; filename="plenary-deadlines.ics"', "cache-control": "private, no-store" },
  });
}
