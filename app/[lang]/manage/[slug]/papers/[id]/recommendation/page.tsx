import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { requireEvent } from "@/lib/manage/data";
import { ManagePage } from "@/components/manage/chrome";
import { ui } from "@/components/manage/ui";
import { Rules, SideStat, Tag } from "@/components/manage/ops1/kit";
import { RecommendForm } from "@/components/manage/ops1/recommend-form";
import { Reveal } from "@/components/motion/reveal";
import { OpsSplitSkeleton } from "@/components/skeletons/ops1";
import { criteriaOf, discussionCount, loadMilestones, loadPaperReviews, loadRecommendation, loadScoreChanges, myAePapers, requirePaper } from "@/lib/manage/ops1-data";
import { paperId, recTone, REVIEW_REC_LABEL } from "@/lib/manage/ops1-shared";
import { getAnnotations } from "@/lib/reviewpolish/data";
import { AnnotationsCard } from "@/components/reviewpolish/manage";

/* EM24 — the AE's recommendation for one paper. */

type P = { params: Promise<{ slug: string; id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Your recommendation") };
}

const gist = (s: string) => { const x = s.trim().split(/(?<=[.!?])\s/)[0] ?? ""; return x.length > 110 ? `${x.slice(0, 107)}…` : x; };

async function Inner({ params }: P) {
  const { slug, id } = await params;
  const ctx = await requireEvent(slug, "ae");
  const paper = await requirePaper(ctx, id);
  const t = await getT();
  const min = Number(ctx.settings?.min_reviews ?? 3);
  const me = ctx.ws.me.person!.id;
  const [reviews, rec, changes, posts, mine, ms, annots] = await Promise.all([loadPaperReviews(id), loadRecommendation(id), loadScoreChanges(id), discussionCount(id), myAePapers(ctx.venue.id, me, min), loadMilestones(ctx.venue.id), getAnnotations(id)]);
  const crit = criteriaOf(ctx);
  const done = reviews.filter((r) => r.status === "submitted" && r.round === 1);
  const avgs = done.map((r) => { const v = Object.values(r.scores).map(Number); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }).filter((x): x is number => x != null);
  const avg = avgs.length ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1) : "—";
  const spread = avgs.length > 1 ? (Math.max(...avgs) - Math.min(...avgs)).toFixed(1) : "—";
  const critName = (k: string) => crit.find((c) => c.key === k)?.name ?? k;
  const changeText = changes.filter((c) => c.field.startsWith("scores.") || crit.some((k) => k.key === c.field)).slice(0, 3).map((c) => {
    const r = reviews.find((x) => x.id === c.assignmentId);
    return t("{who} changed {what} {a}→{b} during discussion", { who: r?.label ?? t("A reviewer"), what: critName(c.field.replace(/^scores\./, "")), a: c.from ?? "–", b: c.to ?? "–" });
  });
  const due = ms.find((m) => m.key === "decisions")?.at;
  return (
    <ManagePage ctx={ctx} active="papers" crumb={<>{t("Associate editor")} · {ctx.label} / {paperId(paper.number)}</>}
      title={t("Your recommendation · {id}", { id: paperId(paper.number) })}
      sub={done.length >= min ? t("All reviews and the discussion are in. Summarise them for the program chair and recommend a decision.") : t("Waiting for reviews — {a} of {b} are in.", { a: done.length, b: min })}>
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <section className={ui.card}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={ui.h2}>{t("Reviews")}</h2>
              <span className="text-[13px] text-[#4A5263]">{t("Discussion: {n} posts", { n: posts })}</span>
            </div>
            <p className="m-0 mt-1 text-[13px] text-[#4A5263]">{paper.title}</p>
            <ul className="m-0 mt-3 flex list-none flex-col p-0">
              {reviews.filter((r) => r.round === 1).map((r) => {
                const [bg, ink] = recTone(r.recommendation);
                return (
                  <li key={r.id} className="grid grid-cols-1 items-center gap-2 border-b border-[#EEF0EC] py-3 last:border-0 sm:grid-cols-[110px_140px_1fr_auto]">
                    <span className="font-semibold">{r.label}</span>
                    <span>{r.status === "submitted" ? <Tag bg={bg} ink={ink}>{t(REVIEW_REC_LABEL[r.recommendation ?? ""] ?? "—")}</Tag> : <Tag bg="#EEF0EC" ink="#4A5263">{t(r.status === "accepted" ? "IN PROGRESS" : r.status.toUpperCase())}</Tag>}</span>
                    <span className="text-[13px] text-[#4A5263]">{r.status === "submitted" ? gist(r.toAuthors) : r.dueAt ? t("due {d}", { d: new Date(r.dueAt).toLocaleDateString(t.intl, { day: "numeric", month: "short" }) }) : ""}</span>
                    <span className="font-mono text-[13px]" title={crit.map((c) => c.name).join(" · ")}>{crit.map((c) => r.scores[c.key] ?? "–").join(" ")}</span>
                  </li>
                );
              })}
              {!reviews.length ? <li className="py-3 text-[14px] text-[#4A5263]">{t("No reviewers yet.")}</li> : null}
            </ul>
            <p className="m-0 mt-3 rounded-[6px] bg-[#F7F8F6] px-3 py-2 text-[13px] text-[#4A5263]">
              {[t("Average {a} · spread {b}", { a: avg, b: spread }), ...changeText].join(" · ")}
            </p>
          </section>
          <RecommendForm slug={slug} submission={id} initial={rec} reviewsIn={done.length} min={min} backHref={`/manage/${slug}/papers/${id}/reviewers`} />
        </div>
        <div className="flex flex-col gap-4">
          {annots.length ? <AnnotationsCard items={annots} /> : null}
          {mine.total ? <SideStat kicker={t("Your AE papers")} value={`${mine.recsSent} / ${mine.total}`} sub={[t("recommendations sent"), due ? t("due {d}", { d: new Date(due).toLocaleDateString(t.intl, { day: "numeric", month: "short", timeZone: "UTC" }) }) : ""].filter(Boolean).join(" · ")} /> : null}
          <Rules title={t("Rules on this page")} items={[
            ["F1", t("Only the program chair decides; AEs recommend.")],
            ["F2", t("At least {n} reviews before a recommendation.", { n: min })],
            ["F6", t("Confidential notes never reach authors.")],
          ]} />
        </div>
      </div>
    </ManagePage>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<OpsSplitSkeleton active="papers" />}><Inner {...props} /></Reveal>;
}
