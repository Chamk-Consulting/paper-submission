import { NextResponse } from "next/server";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { myFollows } from "@/lib/workspace/events";
import { createClient } from "@/lib/supabase/server";

/** What the shared header and side menu need about the signed-in person. Never cached. */
export async function GET() {
  const ctx = await getWorkspaceCtx();
  const headers = { "cache-control": "private, no-store" };
  if (!ctx) return NextResponse.json({ signedIn: false }, { headers });
  const supabase = await createClient();
  const [{ data: admin }, following] = await Promise.all([supabase.rpc("is_platform_admin"), myFollows(ctx.me.person?.id)]);
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
  }, { headers });
}
