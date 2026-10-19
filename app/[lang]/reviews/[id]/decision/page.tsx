import Link from "next/link";
import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { ReviewSkeleton } from "@/components/skeletons/review";
import { Banner, Cols, Crumbs, Head, NotYours, Tag, asideLink, box, kick } from "@/components/review/parts";
import { loadReview } from "@/lib/review/page";
import { getPaperReviews } from "@/lib/review/data";
import { DECISION_LABEL, REC_LABEL, fmtDayYear, partyLabel, recTone } from "@/lib/review/shared";
import { getT } from "@/lib/i18n/server";
import { ui } from "@/components/manage/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Decision") };
}

const EDITOR_TAGS: Record<string, string> = { helpful: "Helpful", specific: "Specific", on_time: "On time", thorough: "Thorough", constructive: "Constructive" };

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { ctx, form, t, no } = await loadReview(params, "/decision");
  if (!form) return <WorkspaceShell ctx={ctx} active="reviews"><NotYours t={t} /></WorkspaceShell>;
  const a = form.assignment;
  const d = form.decision;
  const head = (
    <>
      <Crumbs items={[[t("Reviews"), "/reviews"], [no, null]]} />
      <Head title={t("Decision on {no}", { no })} sub={t("You reviewed this paper for {venue}. Here is what was decided and what the others said.", { venue: form.venue.name })} />
    </>
  );
  if (!d) {
    return (
      <WorkspaceShell ctx={ctx} active="reviews">
        {head}
        <div className="mt-5 max-w-[680px]"><Banner tone="info">{t("The decision hasn't been released yet. You'll get an email when it is.")}</Banner></div>
      </WorkspaceShell>
    );
  }
  const reviews = (await getPaperReviews(a.submission_id)).filter((r) => r.status === "submitted" && r.round === a.round);
  const mine = reviews.find((r) => r.is_me);
  const others = reviews.filter((r) => !r.is_me);
  const pos = (v: number) => ((v - 1) / 4) * 100;
  const tone = d.decision.startsWith("accept") ? "g" : d.decision === "conditional" ? "a" : "r";

  return (
    <WorkspaceShell ctx={ctx} active="reviews">
      {head}
      <Cols
        main={
          <>
            <section className={ui.card}>
              <div className="flex flex-wrap items-center gap-2.5">
                <Tag tone={tone}>{t(DECISION_LABEL[d.decision] ?? d.decision)}</Tag>
                <span className="text-[13px] text-[#4A5263]">{t("Released {d}", { d: fmtDayYear(d.released_at, t.intl) })}</span>
              </div>
              <h2 className={`${ui.h2} mt-3`}>{form.paper.title}</h2>
              {d.editor_summary ? <p className="mb-0 mt-3 whitespace-pre-line text-[15px] leading-[1.6]"><strong>{t("Editor's summary:")}</strong> {d.editor_summary}</p> : null}
            </section>
            {reviews.length > 1 ? (
              <section className={ui.card}>
                <h2 className={ui.h2}>{t("Your scores compared")}</h2>
                <div className="mt-4 flex flex-col gap-4">
                  {form.settings.criteria.map((c) => {
                    const vals = reviews.map((r) => r.scores?.[c.key]).filter((v): v is number => typeof v === "number");
                    if (!vals.length) return null;
                    const lo = Math.min(...vals), hi = Math.max(...vals), avg = vals.reduce((s, v) => s + v, 0) / vals.length;
                    const you = mine?.scores?.[c.key];
                    return (
                      <div key={c.key}>
                        <div className="flex justify-between text-[14px]"><span>{t(c.name)}</span><span className="font-mono text-[12px] text-[#4A5263]">{t("you {y} · avg {a}", { y: you ?? "–", a: avg.toFixed(1) })}</span></div>
                        <div className="relative mt-1.5 h-3 rounded-full bg-[#EEF0EC]">
                          <span className="absolute top-0 h-3 rounded-full bg-[#C9D6F5]" style={{ left: `${pos(lo)}%`, width: `${Math.max(2, pos(hi) - pos(lo))}%` }} />
                          <span aria-hidden className="absolute -top-0.5 h-4 w-0.5 bg-[#4A5263]" style={{ left: `${pos(avg)}%` }} />
                          {you ? <span aria-hidden className="absolute -top-1 size-5 -translate-x-1/2 rounded-full border-2 border-white bg-[#2F5FD0]" style={{ left: `${pos(you)}%` }} /> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mb-0 mt-3 text-[12px] text-[#4A5263]">{t("● you · | average · blue band = range of the {n} reviewers", { n: reviews.length })}</p>
              </section>
            ) : null}
            {others.length ? (
              <section className={ui.card}>
                <h2 className={ui.h2}>{t("Other reviews")}</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {others.map((o) => (
                    <details key={o.assignment_id} className="rounded-[6px] border border-[#DADDE3] px-3.5 py-2.5">
                      <summary className="flex cursor-pointer items-center gap-2 text-[14px] font-medium">
                        {partyLabel(t, o.label)} <Tag tone={recTone(o.recommendation)}>{o.recommendation ? t(REC_LABEL[o.recommendation]) : "—"}</Tag>
                      </summary>
                      <p className="mb-0 mt-2 whitespace-pre-line text-[14px] leading-[1.6]">{o.to_authors}</p>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        }
        aside={
          <>
            {a.editor_rating ? (
              <section className={box}>
                <p className={kick}>{t("Editor's rating of your review")}</p>
                {a.editor_tags.length ? <p className="mb-0 mt-1.5 text-[14px]">{a.editor_tags.map((x) => t(EDITOR_TAGS[x] ?? x)).join(" · ")}</p> : null}
                <div aria-label={t("{n} of 5", { n: a.editor_rating })} className="mt-1 text-[20px] tracking-[2px] text-[#F2A93B]">{"★".repeat(a.editor_rating)}<span className="text-[#DADDE3]">{"★".repeat(5 - a.editor_rating)}</span></div>
                <p className="mb-0 mt-1 text-[12px] text-[#4A5263]">{t("Only you see this. It helps editors invite reliable reviewers.")}</p>
              </section>
            ) : null}
            <section className={box}>
              <p className={kick}>{t("Credit")}</p>
              <p className="mb-1 mt-1.5 text-[14px]">{a.orcid_push ? `✓ ${t("Added to your ORCID record")}` : t("Not sent to ORCID")}</p>
              {a.status === "submitted" ? <a href={`/api/reviews/certificate/${form.venue.slug}`} className={asideLink}>{t("Download certificate")}</a> : null}
              <Link href="/reviews" className={asideLink}>{t("Back to Reviews")}</Link>
            </section>
          </>
        }
      />
    </WorkspaceShell>
  );
}

/** Canvas RV08-Decision. */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Reveal fallback={<ReviewSkeleton variant="form" />}>
      <Inner params={params} />
    </Reveal>
  );
}
