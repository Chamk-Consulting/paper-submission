import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { requireEvent } from "@/lib/manage/data";
import { createClient } from "@/lib/supabase/server";
import { loadRooms, loadSessions } from "@/lib/manage/ops2-data";
import { daysBetween } from "@/lib/manage/ops2-time";
import { ManagePage, ui } from "@/components/manage/chrome";
import { ProgramBuilder, type Clash, type Person, type PoolPaper } from "@/components/manage/ops2/program-builder";
import { Reveal } from "@/components/motion/reveal";
import { ProgramSkeleton } from "@/components/skeletons/ops2";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Program builder") };
}

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  const t = await getT();
  const supabase = await createClient();
  const id = ctx.venue.id;
  const [sessions, rooms, { data: pool }, { data: clashes }, { data: people }, { data: pubs }] = await Promise.all([
    loadSessions(id), loadRooms(id),
    supabase.rpc("program_pool", { p_venue: id }),
    supabase.rpc("program_clashes", { p_venue: id }),
    supabase.rpc("venue_people", { p_venue: id }),
    supabase.from("program_publications").select("published_at").eq("venue_id", id).order("published_at", { ascending: false }).limit(1),
  ]);
  const days = ctx.venue.starts_on ? daysBetween(ctx.venue.starts_on, ctx.venue.ends_on ?? ctx.venue.starts_on) : [];
  return (
    <ManagePage ctx={ctx} active="program" wide title={t("Program builder")} sub={t("Place accepted, complete papers into rooms and time slots. Clashes are checked as you go.")}
      actions={<Link href={`/manage/${slug}/program/print`} className={ui.ghost}>{t("Export PDF")}</Link>}>
      <ProgramBuilder slug={slug} tz={ctx.venue.timezone} days={days} rooms={rooms} sessions={sessions}
        pool={(pool ?? []) as PoolPaper[]} clashes={(clashes ?? []) as Clash[]}
        people={((people ?? []) as { person_id: string; display_name: string | null; roles: string[] | null }[]).map((p) => ({ person_id: p.person_id, display_name: p.display_name ?? "—", roles: p.roles ?? [] })) satisfies Person[]}
        perSession={Number(ctx.settings?.papers_per_session ?? 5)} publishedAt={(pubs?.[0]?.published_at as string) ?? null} canEdit={ctx.isChair} />
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<ProgramSkeleton />}><Inner {...props} /></Reveal>;
}
