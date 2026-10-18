import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireEvent } from "@/lib/manage/data";
import { ManagePage } from "@/components/manage/chrome";
import { KpiRow, Rules } from "@/components/manage/ops1/kit";
import { ProgressBoard, type ProgressRow } from "@/components/manage/ops1/progress-board";
import { Reveal } from "@/components/motion/reveal";
import { OpsTableSkeleton } from "@/components/skeletons/ops1";
import { loadExtensions, loadMilestones, loadPapers, loadSlots, loadTemplates } from "@/lib/manage/ops1-data";

/* EM25 — review progress: who is late, which papers are short, extension requests. */

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Review progress") };
}

const nowMs = () => Date.now();

async function Inner({ params }: P) {
  const { slug } = await params;
  const ctx = await requireEvent(slug);
  const t = await getT();
  const now = nowMs();
  const [papers, slots, ext, ms, tpls] = await Promise.all([loadPapers(ctx.venue.id), loadSlots(ctx.venue.id), loadExtensions(ctx.venue.id), loadMilestones(ctx.venue.id), loadTemplates(ctx.venue.id, ["review_reminder"])]);
  const min = Number(ctx.settings?.min_reviews ?? 3);
  const live = papers.filter((p) => ["review", "submitted", "decision"].includes(p.stage) && p.decision !== "desk_reject");
  const bySub = new Map<string, typeof slots>();
  for (const s of slots) if (s.round === 1 && ["invited", "accepted", "submitted"].includes(s.status)) bySub.set(s.submissionId, [...(bySub.get(s.submissionId) ?? []), s]);
  const rows: ProgressRow[] = live.map((p) => {
    const ss = (bySub.get(p.id) ?? []).sort((a, b) => Number(b.status === "submitted") - Number(a.status === "submitted"));
    const late = ss.filter((s) => s.status === "accepted" && Date.parse(s.dueAt) < now);
    const oldest = late.length ? Math.max(...late.map((s) => Math.ceil((now - Date.parse(s.dueAt)) / 864e5))) : 0;
    return { id: p.id, number: p.number, title: p.title, ae: p.aeName, inCount: ss.filter((s) => s.status === "submitted").length, lateDays: oldest,
      slots: ss.map((s) => ({ id: s.id, reviewer: s.reviewer, due: s.dueAt, state: s.status === "submitted" ? "done" : s.status === "accepted" && Date.parse(s.dueAt) < now ? "late" : "waiting" }) as ProgressRow["slots"][number]) };
  }).sort((a, b) => b.lateDays - a.lateDays || a.inCount - b.inCount);
  const total = live.length * min;
  const got = rows.reduce((a, r) => a + Math.min(r.inCount, min), 0);
  const overdue = rows.reduce((a, r) => a + r.slots.filter((s) => s.state === "late").length, 0);
  const short = rows.filter((r) => r.inCount < min).length;
  const due = ms.find((m) => m.key === "reviews_due")?.at;
  const dec = ms.find((m) => m.key === "decisions")?.at ?? null;
  const n = (x: number) => x.toLocaleString(t.intl);
  const tpl = tpls.review_reminder ?? { subject: "Reminder: review of [paper.id] due [deadline]", body: "Dear [reviewer.first],\n\nThis is a reminder that your review of [paper.id] is due [deadline].\n\n[link]" };
  return (
    <ManagePage ctx={ctx} active="reviews" crumb={<>{t("Organizer")} · {ctx.label} · {t("Review progress")}</>} title={t("Review progress")} sub={t("Who is late, which papers are short of reviews, and extension requests.")}>
      <div className="flex flex-col gap-4">
        <KpiRow items={[
          { l: t("Reviews in"), v: total ? `${Math.round((got / total) * 100)}%` : "—", s: t("{a} of {b}", { a: n(got), b: n(total) }) },
          { l: t("Overdue"), v: n(overdue), s: t("reminded every 2 days"), c: overdue ? "#B3261E" : "#121826" },
          { l: t("Papers short of {n}", { n: min }), v: n(short), s: t("can’t be decided (F2)"), c: short ? "#A8600F" : "#121826" },
          { l: t("Due"), v: due ? new Date(Date.parse(due) - 12 * 3600e3).toLocaleDateString(t.intl, { day: "numeric", month: "short", timeZone: "UTC" }) : "—", s: due ? (Date.parse(due) > now ? t("in {n} days", { n: Math.ceil((Date.parse(due) - now) / 864e5) }) : t("passed")) : t("no date set") },
        ]} />
        <ProgressBoard slug={slug} rows={rows} min={min} decisionsAt={dec} template={{ subject: tpl.subject, body: tpl.body }}
          ext={ext.map((e) => ({ id: e.id, reviewer: e.reviewer, number: e.number, requestedUntil: e.requestedUntil, dueAt: e.dueAt, status: e.status, offeredUntil: e.offeredUntil, message: e.message }))} />
        <div className="lg:max-w-[320px] lg:self-end">
          <Rules title={t("Rules on this page")} items={[
            ["E3", t("{n} reviews needed before a decision.", { n: min })],
            ["E10", t("Overdue reminders can’t be switched off.")],
            ["C7", t("Personal extensions end before the next phase.")],
            ["I3", t("Bulk email: preview, count, test.")],
          ]} />
        </div>
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<OpsTableSkeleton active="reviews" />}><Inner {...props} /></Reveal>;
}
