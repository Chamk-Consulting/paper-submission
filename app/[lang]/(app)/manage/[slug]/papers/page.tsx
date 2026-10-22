import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireEvent } from "@/lib/manage/data";
import { ManagePage } from "@/components/manage/chrome";
import { KpiRow, HiddenNotice } from "@/components/manage/ops1/kit";
import { PapersTable, type PaperListRow } from "@/components/manage/ops1/papers-table";
import { Reveal } from "@/components/motion/reveal";
import { OpsTableSkeleton } from "@/components/skeletons/ops1";
import { loadDashCounts, loadPaperAuthors, loadPapers } from "@/lib/manage/ops1-data";

/* EM21 — papers: everything submitted, with checks and flags. */

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ f?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Papers") };
}

async function Inner({ params, searchParams }: P) {
  const { slug } = await params;
  const { f } = await searchParams;
  const ctx = await requireEvent(slug);
  const t = await getT();
  const [papers, counts, authors] = await Promise.all([loadPapers(ctx.venue.id), loadDashCounts(ctx.venue.id), ctx.isChair ? loadPaperAuthors(ctx.venue.id) : Promise.resolve([])]);
  const byPaper = new Map<string, typeof authors>();
  for (const a of authors) byPaper.set(a.submissionId, [...(byPaper.get(a.submissionId) ?? []), a]);
  const rows: PaperListRow[] = papers.map((p) => {
    const au = byPaper.get(p.id) ?? [];
    return { id: p.id, number: p.number, title: p.title, paperType: p.paperType, topic: p.topic, stage: p.stage, authors: au.map((a) => a.name), authorCount: p.authorCount, countries: p.countries,
      pdf: p.pdf, similarity: p.similarity, confirmed: au.length ? au.filter((a) => a.confirmation === "confirmed" || a.position === 1).length : p.authorCount, aeName: p.aeName, decision: p.decision, released: p.released };
  });
  const n = (x: number) => x.toLocaleString(t.intl);
  const flags = rows.filter((r) => (r.similarity ?? 0) >= 30).length;
  const waiting = rows.filter((r) => r.confirmed < r.authorCount).length;
  return (
    <ManagePage ctx={ctx} active="papers" crumb={<>{t("Organizer")} · {ctx.label} · {t("Papers")}</>} title={t("Papers")} sub={t("Everything submitted to {event}, with checks and flags.", { event: ctx.label })}>
      <div className="flex flex-col gap-4">
        <KpiRow items={[
          { l: t("Submitted"), v: n(rows.length), s: t("not counting drafts") },
          { l: t("Drafts"), v: n(counts.drafts), s: t("not yet submitted"), c: "#4A5263" },
          { l: t("Similarity ≥ 30%"), v: n(flags), s: t("flagged, not rejected (D9)"), c: flags ? "#B3261E" : "#121826" },
          { l: t("Unconfirmed co-authors"), v: n(waiting), s: t("not blocking (D5)"), c: waiting ? "#A8600F" : "#121826" },
        ]} />
        <PapersTable slug={slug} rows={rows} canDesk={ctx.isChair} initialFilter={["flag", "pdf", "coauth"].includes(f ?? "") ? f! : "all"} label={ctx.label} />
        <HiddenNotice n={counts.myPapers} text={t("{n} paper(s) hidden — you are an author. They are handled by the deputy chair and counted in totals only (B1, B3).", { n: counts.myPapers })} why={t("Why?")} />
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<OpsTableSkeleton active="papers" />}><Inner {...props} /></Reveal>;
}
