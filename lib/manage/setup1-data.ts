import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { CHAIR_ROLES } from "@/lib/manage/data";

/* Data for /manage and /manage/new (no event context yet). */

export type MyEvent = { venueId: string; slug: string; name: string; shortName: string | null; status: string; roles: string[]; startsOn: string | null };

export async function requireSignedIn(next: string) {
  const ws = await getWorkspaceCtx();
  if (!ws) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return ws;
}

export async function myEvents(): Promise<MyEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_events");
  return ((data ?? []) as { venue_id: string; slug: string; name: string; short_name: string | null; status: string; roles: string[]; starts_on: string | null }[])
    .map((e) => ({ venueId: e.venue_id, slug: e.slug, name: e.name, shortName: e.short_name, status: e.status, roles: e.roles, startsOn: e.starts_on }));
}

export const canCopy = (e: MyEvent) => e.roles.some((r) => (CHAIR_ROLES as readonly string[]).includes(r));
