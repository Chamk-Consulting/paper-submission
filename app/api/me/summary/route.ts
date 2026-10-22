import { NextResponse } from "next/server";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { myFollows } from "@/lib/workspace/events";
import { createClient } from "@/lib/supabase/server";
import { parseUi } from "@/lib/account/ui-prefs";
import { byNext, getEventRows } from "@/lib/workspace/events-pages";
import { getWorkCounts } from "@/lib/workspace/my-work";

/** What the shared header and side menu need about the signed-in person. Never cached. */
export async function GET() {
  const ctx = await getWorkspaceCtx();
  const headers = { "cache-control": "private, no-store" };
  if (!ctx) return NextResponse.json({ signedIn: false }, { headers });
  const supabase = await createClient();
  const [{ data: admin }, following, ev] = await Promise.all([supabase.rpc("is_platform_admin"), myFollows(ctx.me.person?.id), getEventRows()]);
  const nowMs = Date.parse(ev.generatedAt);
  const current = ev.rows.filter((r) => !r.past && (r.mine || r.reg)).sort(byNext(nowMs));
  const work = await getWorkCounts(ctx.me.person?.id, ev.rows, nowMs, ctx.venues.flatMap((v) => v.roles));
  return NextResponse.json({
    signedIn: true,
    name: ctx.name,
    initials: ctx.initials,
    plenaryId: ctx.me.person?.plenary_id ?? null,
    unread: ctx.unread,
    submissionCount: ctx.submissionCount,
    venues: ctx.venues.map((v) => ({ slug: v.slug, name: v.name, shortName: v.shortName, roles: v.roles })),
    organizerOf: ctx.organizerOf?.slug ?? null,
    isAdmin: admin === true,
    following: following.slice(0, 12).map((f) => ({ slug: f.slug, name: f.name, shortName: f.shortName })),
    currentEvents: current.slice(0, 3).map((r) => ({ slug: r.v.slug, name: r.v.acr })),
    myEventsCount: current.length,
    work,
    followingCount: ev.rows.filter((r) => r.following && !r.past).length,
    timezone: (ctx.me.person as { timezone?: string | null } | null)?.timezone ?? null,
    ui: parseUi((ctx.me.person as { ui_prefs?: unknown } | null)?.ui_prefs),
  }, { headers });
}
