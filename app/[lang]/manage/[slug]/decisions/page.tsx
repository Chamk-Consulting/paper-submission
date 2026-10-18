import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireEvent } from "@/lib/manage/data";
import { ManagePage } from "@/components/manage/chrome";
import { HiddenNotice } from "@/components/manage/ops1/kit";
import { DecisionTable, type DecisionRow } from "@/components/manage/ops1/decision-table";
import { Reveal } from "@/components/motion/reveal";
import { OpsTableSkeleton } from "@/components/skeletons/ops1";
import { loadDashCounts, loadLetterReviews, loadPapers } from "@/lib/manage/ops1-data";

/* EM26 — decision table (program chair). */

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Decisions") };
}

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug, "chair");
  const t = await getT();
  const [papers, reviews, counts] = await Promise.all([loadPapers(ctx.venue.id), loadLetterReviews(ctx.venue.id), loadDashCounts(ctx.venue.id)]);
  const min = Number(ctx.settings?.min_reviews ?? 3);
  const scores = new Map<string, number[]>();
  for (const r of reviews) {
    const v = Object.values(r.scores).map(Number).filter((x) => !Number.isNaN(x));
    if (v.length) scores.set(r.submissionId, [...(scores.get(r.submissionId) ?? []), Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10]);
  }
  const rows: DecisionRow[] = papers.filter((p) => !["withdrawn", "draft"].includes(p.stage)).map((p) => ({
    id: p.id, number: p.number, title: p.title, topic: p.topic, scores: scores.get(p.id) ?? [], avg: p.avg, spread: p.spread, aeRec: p.aeRec, decision: p.decision, released: p.released, reviewsIn: p.reviewsIn,
  })).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  return (
    <ManagePage ctx={ctx} active="decisions" crumb={<>{t("Organizer")} · {ctx.label} · {t("Decisions")}</>} title={t("Decision table")} sub={t("Draft decisions here. Nothing reaches authors until you release them.")}>
      <div className="flex flex-col gap-4">
        <DecisionTable slug={slug} rows={rows} min={min} canChangeReleased={ctx.isOwner} />
        <HiddenNotice n={counts.myPapers} text={t("{n} paper(s) hidden — you are an author. They are handled by the deputy chair and counted in totals only (B1, B3).", { n: counts.myPapers })} why={t("Why?")} />
        <p className="m-0 text-[13px] text-[#4A5263]">{t("Spread = highest minus lowest score. Spread ≥ 2 often means reviewers disagree — read the discussion before deciding.")}</p>
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<OpsTableSkeleton active="decisions" />}><Inner {...props} /></Reveal>;
}
