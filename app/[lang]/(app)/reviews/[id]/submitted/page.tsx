import Link from "@/components/site/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { ReviewSkeleton } from "@/components/skeletons/review";
import { OrcidToggle, PrintButton } from "@/components/review/small";
import { Cols, Crumbs, Head, NotYours, asideLink, box, kick } from "@/components/review/parts";
import { loadReview } from "@/lib/review/page";
import { getMyReviews, getPaperReviews } from "@/lib/review/data";
import { CONF_LABEL, REC_LABEL, fmtDayYear, paperNo } from "@/lib/review/shared";
import { getT } from "@/lib/i18n/server";
import { ui } from "@/components/manage/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Review submitted") };
}

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id, ctx, form, t, no, ae } = await loadReview(params, "/submitted");
  if (!form) return <WorkspaceShell ctx={ctx} active="reviews"><NotYours t={t} /></WorkspaceShell>;
  const a = form.assignment;
  if (a.status !== "submitted") redirect(`/reviews/${id}`);
  const [reviews, mine] = await Promise.all([getPaperReviews(a.submission_id), getMyReviews()]);
  const r = form.review;
  const received = reviews.filter((x) => x.status === "submitted" && x.round === a.round).length;
  const next = mine.find((m) => m.status === "accepted" && m.assignment_id !== id);
  const waiting = mine.filter((m) => m.status === "invited").length;
  const editable = !a.locked_at && form.paper.stage !== "withdrawn";

  return (
    <WorkspaceShell ctx={ctx} active="reviews">
      <Crumbs items={[[t("Reviews"), "/reviews"], [no, `/reviews/${id}`], [t("Submitted"), null]]} />
      <Head title={t("Review submitted")} sub={t("Thank you. {ae} has your review of {no}.", { ae, no })} />
      <Cols
        main={
          <>
            <section className={ui.card}>
              <p className="m-0 font-mono text-[12px] text-[#4A5263]">{t("Submitted {d}", { d: fmtDayYear(a.submitted_at, t.intl) })}{a.receipt ? ` · ${t("receipt")} ${a.receipt}` : ""}</p>
              <h2 className={`${ui.h2} mt-2`}>{form.paper.title}</h2>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {form.settings.criteria.map((c) => (
                  <div key={c.key} className="rounded-[6px] border border-[#DADDE3] px-3 py-2.5 text-center">
                    <div className="font-serif text-[28px] leading-none">{r?.scores?.[c.key] ?? "—"}</div>
                    <div className="mt-1 text-[12px] text-[#4A5263]">{t(c.name)}</div>
                  </div>
                ))}
              </div>
              <p className="mb-0 mt-3 text-[14px]">
                {t("Recommendation:")} <strong>{r?.recommendation ? t(REC_LABEL[r.recommendation]) : "—"}</strong> · {t("Confidence:")} <strong>{r?.confidence ? t(CONF_LABEL[r.confidence]) : "—"}</strong>
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-[#EEF0EC] pt-4">
                {editable ? <span className="w-full text-[14px] text-[#4A5263]">{t("You can edit your review until the editor starts the decision.")}</span> : null}
                {editable ? <Link href={`/reviews/${id}`} className={ui.ghost}>{t("Edit review")}</Link> : <Link href={`/reviews/${id}`} className={ui.ghost}>{t("View review")}</Link>}
                <PrintButton label={t("Download as PDF")} />
              </div>
            </section>
            <section className={ui.card}>
              <h2 className={ui.h2}>{t("What happens next")}</h2>
              <ol className="mb-0 mt-3 flex list-decimal flex-col gap-2 pl-5 text-[15px]">
                <li>{t("The editor waits for all reviews — {n} of {m} received.", { n: received, m: Math.max(a.total, received) })}</li>
                <li>{form.settings.discussion ? t("Reviewers discuss the paper. You'll get an email when the discussion opens.") : t("The editor reads the reviews and recommends a decision.")}</li>
                <li>{t("You'll see the decision and the other reviews when the decision is released.")}</li>
              </ol>
              {form.settings.discussion && received > 1 ? <Link href={`/reviews/${id}/discussion`} className="mt-3 inline-block text-[14px] text-[#2F5FD0]">{t("Open the discussion →")}</Link> : null}
            </section>
            <section className={ui.card}>
              <h2 className={ui.h2}>{t("Get credit")}</h2>
              <div className="mt-3"><OrcidToggle id={id} initial={a.orcid_push} /></div>
              {a.status === "submitted" ? <a href={`/api/reviews/certificate/${form.venue.slug}`} className="mt-3 inline-block text-[14px] text-[#2F5FD0]">{t("Download reviewer certificate (PDF)")}</a> : null}
            </section>
          </>
        }
        aside={
          <>
            <section className={box}>
              <p className={kick}>{t("Next review")}</p>
              {next ? (
                <>
                  <p className="mb-1 mt-1.5 text-[14px]"><span className="font-mono text-[12px] text-[#4A5263]">{paperNo(next.paper_number)}</span> · {next.title}</p>
                  <p className="m-0 text-[13px] text-[#4A5263]">{t("due {d}", { d: fmtDayYear(next.due_at, t.intl) })}</p>
                  <Link href={`/reviews/${next.assignment_id}`} className={asideLink}>{t("Continue →")}</Link>
                </>
              ) : <p className="mb-0 mt-1.5 text-[14px] text-[#4A5263]">{t("Nothing else is due. Well done.")}</p>}
            </section>
            <section className={box}>
              <p className={kick}>{t("Invitations waiting")}</p>
              <div className="mt-1 font-serif text-[28px] leading-none">{waiting}</div>
              <Link href="/reviews" className={asideLink}>{t("Back to the review list")}</Link>
            </section>
          </>
        }
      />
    </WorkspaceShell>
  );
}

/** Canvas RV04-ReviewSent. */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Reveal fallback={<ReviewSkeleton variant="narrow" />}>
      <Inner params={params} />
    </Reveal>
  );
}
