import { createClient } from "@/lib/supabase/server";
import { keptPapers, xploreXml, type XPaper, type XVenue } from "@/lib/manage/xplore";

/*
 * EM32 step 4 — proceedings metadata as XML for the IEEE Conference Publishing portal (one <paper> per kept paper:
 * presented, or a no-show kept by exception). Organizers with a proceedings role only; RLS + the RPC's role check apply.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const { data: venue } = await supabase.from("venues").select("id, name, short_name, starts_on, ends_on, location").eq("slug", slug).maybeSingle();
  if (!venue) return new Response("Not found", { status: 404 });
  const { data, error } = await supabase.rpc("proceedings_papers", { p_venue: venue.id });
  if (error) return new Response("Not allowed", { status: 403 });
  const papers = keptPapers((data ?? []) as XPaper[]);
  if (!papers.length && !(data ?? []).length) return new Response("Not allowed or nothing to export", { status: 403 });

  return new Response(xploreXml(venue as XVenue, papers), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-xplore.xml"`,
      "Cache-Control": "private, no-store",
    },
  });
}
