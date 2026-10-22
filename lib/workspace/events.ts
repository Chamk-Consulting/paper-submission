import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getMyPapers, getWorkspaceCtx } from "@/lib/workspace/data";

/** What the signed-in person has at one event: their roles there and their papers (newest first). */
import type { MyEvents } from "@/lib/workspace/event-action";
export type { MyEvent, MyEventPaper, MyEvents } from "@/lib/workspace/event-action";

/** Per event slug: roles, papers and whether they follow it. Used by Find events and the workspace event page. */
export const getMyEvents = cache(async (): Promise<MyEvents> => {
  const ctx = await getWorkspaceCtx();
  if (!ctx) return {};
  const personId = ctx.me.person?.id;
  const [{ papers }, follows] = await Promise.all([getMyPapers(personId), myFollows(personId)]);
  const out: MyEvents = {};
  const at = (slug: string) => (out[slug] ??= { roles: [], papers: [], following: false });
  for (const v of ctx.venues) at(v.slug).roles.push(...v.roles);
  for (const p of papers) at(p.venue.slug).papers.push({ id: p.id, href: p.href, title: p.title, number: p.number, stage: p.stage, detail: p.detail });
  for (const f of follows) at(f.slug).following = true;
  return out;
});

/** Events the person follows (slug and names), for the side menu and the Following tab. */
export async function myFollows(personId: string | undefined): Promise<{ id: string; slug: string; name: string; shortName: string | null }[]> {
  if (!personId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("venue_follows").select("venue_id, venues(slug, name, short_name)").eq("person_id", personId);
  return ((data ?? []) as unknown as { venue_id: string; venues: { slug: string; name: string; short_name: string | null } | null }[])
    .flatMap((r) => (r.venues ? [{ id: r.venue_id, slug: r.venues.slug, name: r.venues.name, shortName: r.venues.short_name }] : []))
    .sort((a, b) => (a.shortName ?? a.name).localeCompare(b.shortName ?? b.name));
}

export { primaryAction } from "@/lib/workspace/event-action";
