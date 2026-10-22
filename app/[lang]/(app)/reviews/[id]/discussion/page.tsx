import Link from "@/components/site/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { ReviewSkeleton } from "@/components/skeletons/review";
import { MyScores, Thread } from "@/components/review/discussion";
import { Banner, Cols, Crumbs, Head, NotYours, Tag, asideLink, box, kick } from "@/components/review/parts";
import { loadReview } from "@/lib/review/page";
import { getDiscussion, getPaperReviews } from "@/lib/review/data";
import { REC_LABEL, daysUntil, fmtDay, partyLabel, recTone, scoreTone } from "@/lib/review/shared";
import { getT } from "@/lib/i18n/server";
import { nowMs } from "@/lib/review/format";
import { ui } from "@/components/manage/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Discussion") };
}

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id, ctx, form, t, no } = await loadReview(params, "/discussion");
  if (!form) return <WorkspaceShell ctx={ctx} active="reviews"><NotYours t={t} /></WorkspaceShell>;
  const a = form.assignment;
  if (a.status === "invited") redirect(`/reviews/invitations/${id}`);
  const mineIn = a.status === "submitted";
  const [reviews, posts] = mineIn ? await Promise.all([getPaperReviews(a.submission_id), getDiscussion(a.submission_id)]) : [[], []];
  const now = nowMs();
  const close = form.dates.discussion_close;
  const closed = !!close && new Date(close).getTime() < now;
  const decided = !!form.decision;
  const round = reviews.filter((r) => r.round === a.round);
  const meLabel = partyLabel(t, round.find((r) => r.is_me)?.label ?? `Reviewer ${a.ordinal ?? ""} (you)`);
  const r = form.review;
  const editable = mineIn && !a.locked_at && !decided;

  return (
    <WorkspaceShell ctx={ctx} active="reviews">
      <Crumbs items={[[t("Reviews"), "/reviews"], [no, `/reviews/${id}`], [t("Discussion"), null]]} />
      <Head
        title={t("Discussion · {no}", { no })}
        sub={mineIn ? t("All {n} reviews are in. Read the others, answer the editor, and update your score if you changed your mind.", { n: round.length }) : undefined}
        right={close ? <Tag tone={closed ? "n" : "a"}>{closed ? t("CLOSED {d}", { d: fmtDay(close, t.intl) }) : t("CLOSES {d} · {n} DAYS", { d: fmtDay(close, t.intl), n: Math.max(0, daysUntil(close, now)) })}</Tag> : null}
      />
      {!mineIn ? (
        <div className="mt-5 max-w-[680px]"><Banner tone="info">{t("Other reviews and the discussion open once your own review is in (E7).")} <Link href={`/reviews/${id}`} className="font-semibold">{t("Go to review form")}</Link></Banner></div>
      ) : (
        <Cols
          main={
            <>
              <section className={ui.card}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className={ui.h2}>{t("Reviews side by side")}</h2>
                  <span className="text-[13px] text-[#4A5263]">{form.settings.named_discussion ? t("Names are visible in this event") : t("Anonymous to each other (E8)")}</span>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {round.map((rv) => (
                    <article key={rv.assignment_id} className={`rounded-[6px] border px-3.5 py-3 ${rv.is_me ? "border-[#C9D6F5] bg-[#FBFCFF]" : "border-[#DADDE3]"}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-[14px]">{partyLabel(t, rv.label)}{rv.reviewer_name && !rv.is_me ? ` · ${rv.reviewer_name}` : ""}</strong>
                        <Tag tone={recTone(rv.recommendation)}>{rv.recommendation ? t(REC_LABEL[rv.recommendation]) : "—"}</Tag>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {form.settings.criteria.map((c) => {
                          const v = rv.scores?.[c.key];
                          return <span key={c.key} title={t(c.name)} className={`inline-flex h-7 min-w-7 items-center justify-center rounded-[4px] px-1.5 font-mono text-[13px] ${v ? scoreTone(v) : "bg-[#EEF0EC] text-[#9AA3B5]"}`}>{v ?? "–"}</span>;
                        })}
                      </div>
                      {rv.to_authors ? (
                        <details className="mt-2 text-[14px]">
                          <summary className="cursor-pointer text-[#4A5263]">{rv.to_authors.slice(0, 160)}{rv.to_authors.length > 160 ? "…" : ""}</summary>
                          <p className="mb-0 mt-2 whitespace-pre-line">{rv.to_authors}</p>
                        </details>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
              <Thread id={id} submissionId={a.submission_id} posts={posts} me={meLabel} canPost={!closed && !decided} />
            </>
          }
          aside={
            <>
              {editable ? (
                <MyScores id={id} criteria={form.settings.criteria}
                  initial={{ scores: r?.scores ?? {}, recommendation: r?.recommendation ?? null, confidence: r?.confidence ?? null, to_authors: r?.to_authors ?? "", to_editor: r?.to_editor ?? "" }} />
              ) : null}
              <section className={box}>
                <p className={kick}>{t("Paper")}</p>
                <Link href={`/reviews/${id}/paper`} className={asideLink}>{t("Open in reviewer viewer")}</Link>
                <Link href={`/reviews/${id}/submitted`} className={asideLink}>{t("My submitted review")}</Link>
              </section>
              <section className={box}>
                <p className={kick}>{t("Rules on this page")}</p>
                <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[13px] text-[#4A5263]">
                  <li><span className="mr-1.5 font-mono text-[11px] text-[#121826]">E7</span>{t("Others' reviews visible only after yours is in.")}</li>
                  <li><span className="mr-1.5 font-mono text-[11px] text-[#121826]">E8</span>{t("Reviewers stay anonymous to each other unless the event uses named discussion.")}</li>
                  <li><span className="mr-1.5 font-mono text-[11px] text-[#121826]">B9</span>{t("Score changes are recorded.")}</li>
                </ul>
              </section>
            </>
          }
        />
      )}
    </WorkspaceShell>
  );
}

/** Canvas RV07-Discussion. */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Reveal fallback={<ReviewSkeleton variant="form" />}>
      <Inner params={params} />
    </Reveal>
  );
}
