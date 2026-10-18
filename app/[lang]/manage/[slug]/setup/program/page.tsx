import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { requireEvent, groupStatus, lastChange } from "@/lib/manage/data";
import { ManagePage, SetupLayout } from "@/components/manage/chrome";
import { ProgramForm, type Day, type Room } from "@/components/manage/setup2/program";
import { RulesCard } from "@/components/manage/setup2/rules";
import { Reveal } from "@/components/motion/reveal";
import { SetupFormSkeleton } from "@/components/skeletons/setup2";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Program & rooms") };
}

function defaultDays(start: string | null, end: string | null): Day[] {
  if (!start) return [];
  const out: Day[] = [];
  const d = new Date(`${start}T12:00:00Z`);
  const stop = new Date(`${end ?? start}T12:00:00Z`);
  while (d <= stop && out.length < 21) {
    out.push({ date: d.toISOString().slice(0, 10), label: "", note: "" });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("rooms").select("id, name, seats, equipment").eq("venue_id", ctx.venue.id).order("sort").order("name");
  const rooms: Room[] = ((data ?? []) as { id: string; name: string; seats: number | null; equipment: string | null }[]).map((r) => ({ id: r.id, name: r.name, seats: r.seats, equipment: r.equipment ?? "" }));
  const s = (ctx.settings ?? {}) as Record<string, unknown>;
  const days = Array.isArray(s.program_days) && s.program_days.length
    ? (s.program_days as Partial<Day>[]).map((d) => ({ date: String(d.date ?? ""), label: String(d.label ?? ""), note: String(d.note ?? "") }))
    : defaultDays(ctx.venue.starts_on, ctx.venue.ends_on);
  const clamp = (v: unknown, lo: number, hi: number, dflt: number) => Math.min(hi, Math.max(lo, Number(v ?? dflt) || dflt));
  return (
    <ManagePage ctx={ctx} active="setup" crumb={<>{t("Setup")} · {ctx.label}</>} title={t("Program & rooms")} sub={t("Rooms, session format and days. The schedule itself is built after decisions.")}>
      <SetupLayout ctx={ctx} current="program">
        <div className="flex flex-col items-start gap-6 xl:flex-row">
          <div className="w-full min-w-0 flex-auto">
            <ProgramForm slug={slug} rooms={rooms} days={days} canEdit={ctx.isChair && !ctx.locked} status={groupStatus(ctx, ["program"])} last={lastChange(ctx, ["program"])}
              fmt={{
                minutes_per_paper: clamp(s.minutes_per_paper, 10, 40, 20), papers_per_session: clamp(s.papers_per_session, 3, 8, 5),
                parallel_sessions: clamp(s.parallel_sessions, 1, 12, 4), poster_sessions: s.poster_sessions !== false, allow_remote: s.allow_remote === true,
              }} />
          </div>
          <RulesCard rules={[
            ["H1", "One presenter can't be in two rooms at once."], ["H2", "Clashes are checked automatically."],
            ["H3", "Each session has a chair without a conflict."], ["H4", "Only registered papers are scheduled."],
          ]} />
        </div>
      </SetupLayout>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<SetupFormSkeleton cards={3} />}><Inner {...props} /></Reveal>;
}
