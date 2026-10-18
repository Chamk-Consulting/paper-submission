import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { requireEvent, groupStatus, lastChange } from "@/lib/manage/data";
import { ManagePage, SetupLayout } from "@/components/manage/chrome";
import { DatesForm } from "@/components/manage/setup1/dates-form";
import { aoeDate, type MilestoneKey } from "@/lib/manage/setup1-shared";
import { Reveal } from "@/components/motion/reveal";
import { Setup1Skeleton } from "@/components/skeletons/setup1";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Dates & phases") };
}

/** EM04 — dates & phases. */
async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("venue_dates").select("key, starts_at, is_hard").eq("venue_id", ctx.venue.id).not("key", "is", null);
  const initial: Partial<Record<MilestoneKey, { date: string; hard: boolean }>> = {};
  for (const d of (data ?? []) as { key: MilestoneKey; starts_at: string; is_hard: boolean }[]) initial[d.key] = { date: aoeDate(d.starts_at), hard: d.is_hard };
  return (
    <ManagePage ctx={ctx} active="setup" crumb={<>{t("Setup")} · {ctx.label}</>} title={t("Dates & phases")} sub={t("Every deadline in one place, in the order the event runs.")}>
      <SetupLayout ctx={ctx} current="dates">
        <DatesForm slug={slug} initial={initial} status={groupStatus(ctx, ["dates"])} last={lastChange(ctx, ["dates"])} canEdit={ctx.isChair} opened={ctx.venue.status !== "draft"} />
      </SetupLayout>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<Setup1Skeleton />}><Inner {...props} /></Reveal>;
}
