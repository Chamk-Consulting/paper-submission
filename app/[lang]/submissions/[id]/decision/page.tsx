import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireCtx } from "@/components/submission/frame";
import { asideCard, card, h2, primaryBtn } from "@/components/submission/shell";
import { FlowFrame, meName, no4 } from "@/components/submission/followup/flow-frame";
import { LocalDate } from "@/components/submission/followup/due-pill";
import { OpenViewer } from "@/components/submission/followup/open-viewer";
import { PrintButton } from "@/components/submission/followup/bits";
import { DECISION_LABEL, RECOMMENDATION, loadDecision, loadInfo, loadPaperReviews } from "@/lib/submission/followup-data";
import { Reveal } from "@/components/motion/reveal";
import { DecisionSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Decision and reviews") };
}
type P = { params: Promise<{ id: string }> };

const SCORE_LABEL: Record<string, string> = {
  novelty: "Novelty",
  quality: "Technical quality",
  clarity: "Clarity",
  relevance: "Relevance",
};
const TONE: Record<string, [string, string]> = { accept_oral: ["#E1F3EA", "#14603F"], accept_poster: ["#E1F3EA", "#14603F"], conditional: ["#FBEFDD", "#7A4508"], reject: ["#FDECEA", "#B3261E"], desk_reject: ["#FDECEA", "#B3261E"] };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "status");
  const t = await getT();
  const base = `/submissions/${id}`;
  const [decision, reviews, info] = await Promise.all([loadDecision(id), loadPaperReviews(id), loadInfo(id)]);
  if (!decision) redirect(base);
  const [bg, ink] = TONE[decision.decision];
  const generatedAt = new Date().toISOString();
  const paper = ctx.files.find((f) => f.role === "paper" && f.current);
  const next = decision.decision === "conditional"
    ? { text: decision.revisionDueAt ? t("Submit a revision that answers the reviewers. It is due by the date below.") : t("Submit a revision that answers the reviewers."), cta: t("Start revision"), href: `${base}/revision` }
    : decision.decision === "accept_oral" || decision.decision === "accept_poster"
      ? { text: t("Upload the camera-ready PDF, lock the title and authors, sign the copyright form and register one author."), cta: t("Start final version"), href: `${base}/final` }
      : { text: t("You can revise the paper using the reviews and submit it to another venue."), cta: t("Find another venue"), href: "/venues" };
  return (
    <FlowFrame
      ctx={ctx} crumb={t("Decision")} title={t("Decision and reviews")}
      aside={
        <>
          <section className="rounded-[8px] bg-[#0E1B3D] px-[18px] py-4 text-[#F5F6F3]">
            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#F2A93B]">{t("Next step")}</p>
            <p className="mt-2 text-[15px]">{next.text}</p>
            {decision.revisionDueAt ? <p className="mt-1 text-[13px] text-[#B9C3DA]">{t("Due")} · <LocalDate at={decision.revisionDueAt} generatedAt={generatedAt} time /></p> : null}
            <Link href={next.href} className={`${primaryBtn} mt-3 w-full`}>{next.cta} →</Link>
          </section>
          <section className={asideCard}>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15px]">
              {paper ? <li><OpenViewer id={id} files={[paper]} tab="translate" label={t("Translate the paper")} className="p-0 text-left text-[#2F5FD0] underline-offset-2 hover:underline" /></li> : null}
              <li><PrintButton label={t("Print or save letter and reviews (PDF)")} className="p-0 text-left text-[#2F5FD0] hover:underline" /></li>
              {/* TODO(inbox): link to the chair thread once IN01 lands. */}
              <li><Link href={`/submissions/${id}/message?about=decision`} className="text-[#2F5FD0]">{t("Question about the decision? Message the chair")}</Link></li>
            </ul>
          </section>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[15px] text-[#4A5263]"><span className="font-semibold text-[#121826]">{no4(ctx.sub.number)}</span> · {ctx.sub.title}</p>
        {paper ? <OpenViewer id={id} files={[paper]} label={t("Open paper")} /> : null}
      </div>
      <section className={`${card} mt-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-[4px] px-2.5 py-1 text-[15px] font-semibold" style={{ background: bg, color: ink }}>{t(DECISION_LABEL[decision.decision])}</span>
          <span className="text-[14px] text-[#4A5263]">{t("Sent")} <LocalDate at={decision.releasedAt} generatedAt={generatedAt} /> · {t(ctx.authors.length === 1 ? "to {n} author" : "to all {n} authors", { n: ctx.authors.length })}</span>
        </div>
        <div className="mt-5 font-serif text-[17px] leading-[1.6]">
          <p className="m-0">{t("Dear {name},", { name: meName(ctx) })}</p>
          {(decision.letter ?? "").split(/\n\s*\n/).filter((p) => p.trim()).map((p, i) => <p key={i} className="mt-3 whitespace-pre-line">{p.trim()}</p>)}
          {!decision.letter ? <p className="mt-3">{t("The program committee has reached a decision on your paper. The reviews are below.")}</p> : null}
          <p className="mt-4">{t("Best regards,")}<br />{info?.chair ? t("{name}, Program chair, {venue}", { name: info.chair, venue: ctx.venue.acr }) : t("Program chair, {venue}", { venue: ctx.venue.acr })}</p>
        </div>
        {info?.stats ? (
          <p className="mt-5 rounded-[6px] bg-[#F7F8F6] px-3 py-2 text-[14px] text-[#4A5263]">{t("{venue} statistics: {n} submissions · {p}% accepted", { venue: ctx.venue.acr, n: info.stats.papers, p: pct(info.stats.accepted, info.stats.papers) })}</p>
        ) : null}
      </section>

      {decision.editorSummary ? (
        <section className={`${card} mt-6`}>
          <h2 className={h2}>{t("Associate editor's summary")}</h2>
          <p className="mt-3 whitespace-pre-line text-[15px] leading-[1.6]">{decision.editorSummary}</p>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className={h2}>{t("Reviews ({n})", { n: reviews.length })}</h2>
        {reviews.length === 0 ? <p className="mt-2 text-[#4A5263]">{t("No reviews were shared with the authors.")}</p> : null}
        <div className="mt-3 flex flex-col gap-3">
          {reviews.map((r, i) => (
            <details key={r.assignmentId} open={i === 0} className="group rounded-[8px] border border-[#DADDE3] bg-white">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-[22px] py-4">
                <span className="font-semibold">{t("Reviewer {n}", { n: r.label.replace(/\D+/g, "") || i + 1 })}</span>
                <span className="flex flex-wrap gap-2 text-[13px] text-[#4A5263]">{Object.entries(r.scores).map(([k, v]) => <span key={k}>{t(SCORE_LABEL[k] ?? k)} <span className="font-mono font-semibold text-[#121826]">{v}</span></span>)}</span>
                {r.recommendation ? <span className="ml-auto rounded-[3px] bg-[#EEF0EC] px-2 py-0.5 text-[13px]">{t(RECOMMENDATION[r.recommendation] ?? r.recommendation)}</span> : null}
                <span aria-hidden className="text-[#4A5263] transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="border-t border-[#EEF0EC] px-[22px] py-4">
                <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Comments to the authors")}</p>
                <p className="mt-2 whitespace-pre-line text-[15px] leading-[1.6]">{r.toAuthors || "—"}</p>
              </div>
            </details>
          ))}
        </div>
      </section>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<DecisionSkeleton />}><Inner {...props} /></Reveal>;
}
