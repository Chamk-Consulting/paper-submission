import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireEvent } from "@/lib/manage/data";
import { ManagePage } from "@/components/manage/chrome";
import { KpiRow, HiddenNotice } from "@/components/manage/ops1/kit";
import { AssignBoard } from "@/components/manage/ops1/assign-board";
import { Reveal } from "@/components/motion/reveal";
import { OpsTableSkeleton } from "@/components/skeletons/ops1";
import { loadAEs, loadConflictPairs, loadDashCounts, loadMilestones, loadPapers } from "@/lib/manage/ops1-data";

/* EM22 — assign papers to associate editors. */

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Assignment") };
}

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug, "chair");
  const t = await getT();
  const [papers, aes, coi, ms, counts] = await Promise.all([loadPapers(ctx.venue.id), loadAEs(ctx.venue.id), loadConflictPairs(ctx.venue.id), loadMilestones(ctx.venue.id), loadDashCounts(ctx.venue.id)]);
  const live = papers.filter((p) => ["submitted", "review"].includes(p.stage));
  const aeIds = new Set(aes.map((a) => a.personId));
  const unassigned = live.filter((p) => !p.aeId).length;
  const desk = papers.filter((p) => p.decision === "desk_reject").length;
  const due = ms.find((m) => m.key === "ae_assignment")?.at;
  const atLimit = aes.filter((a) => a.load >= a.cap).length;
  const n = (x: number) => x.toLocaleString(t.intl);
  return (
    <ManagePage ctx={ctx} active="assignment" crumb={<>{t("Organizer")} · {ctx.label} · {t("Assignment")}</>} title={t("Assign associate editors")} sub={t("One associate editor per paper, by topic. Conflicts are blocked (B4).")}>
      <div className="flex flex-col gap-4">
        <KpiRow items={[
          { l: t("Papers"), v: n(live.length), s: desk ? t("after {n} desk rejects", { n: desk }) : t("in review") },
          { l: t("Assigned"), v: n(live.length - unassigned), s: t("to {n} AEs", { n: aes.filter((a) => a.load > 0).length }), c: "#14603F" },
          { l: t("Unassigned"), v: n(unassigned), s: due ? t("deadline {d}", { d: new Date(due).toLocaleDateString(t.intl, { day: "numeric", month: "short", timeZone: "UTC" }) }) : t("no deadline set"), c: unassigned ? "#A8600F" : "#121826" },
          { l: t("AEs at limit"), v: n(atLimit), s: t("{n} papers (E2)", { n: Number(ctx.settings?.ae_cap ?? 15) }), c: atLimit ? "#B3261E" : "#121826" },
        ]} />
        <AssignBoard slug={slug} papers={live.map((p) => ({ id: p.id, number: p.number, title: p.title, topic: p.topic, aeId: p.aeId }))} aes={aes}
          conflicts={coi.filter((c) => aeIds.has(c.personId)).map((c) => `${c.submissionId}:${c.personId}`)} canOverLimit={ctx.roles.includes("owner") || ctx.roles.includes("program_chair")} />
        <HiddenNotice n={counts.myPapers} text={t("{n} paper(s) hidden — you are an author. They are handled by the deputy chair and counted in totals only (B1, B3).", { n: counts.myPapers })} why={t("Why?")} />
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<OpsTableSkeleton active="assignment" filters={false} />}><Inner {...props} /></Reveal>;
}
