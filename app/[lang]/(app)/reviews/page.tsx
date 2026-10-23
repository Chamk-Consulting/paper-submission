import Link from "@/components/site/link";
import { getMe } from "@/lib/auth/me";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { ReviewSkeleton } from "@/components/skeletons/review";
import { ReviewsList, type Row } from "@/components/review/reviews-list";
import { AvailabilityForm } from "@/components/review/availability";
import { Cols, Head, asideLink, box, kick } from "@/components/review/parts";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getAvailability, getMyReviews, getOverview } from "@/lib/review/data";
import { daysUntil, fmtDay, paperNo } from "@/lib/review/shared";
import { relDay, nowMs } from "@/lib/review/format";
import { getT } from "@/lib/i18n/server";
import { certificateVenues } from "@/lib/reviewpolish/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("To review") };
}

type Search = { tab?: string; q?: string; event?: string; sort?: string; week?: string };

async function Inner({ searchParams }: { searchParams: Promise<Search> }) {
  // everything starts together; the shell summary no longer holds up the page's own queries
  const [ctx, reviews, overview, avail, t, sp] = await Promise.all([
    getWorkspaceCtx(), getMyReviews(), getOverview(), getMe().then((m) => getAvailability(m?.person?.id)), getT(), searchParams,
  ]);
  if (!ctx) redirect("/sign-in?next=/reviews");
  const now = nowMs();
  const certs = certificateVenues(reviews);

  const rows: Row[] = reviews.map((r) => {
    const base = { id: r.assignment_id, no: paperNo(r.paper_number), title: r.title, venue: r.venue_short, venueSlug: r.venue_slug, num: r.paper_number };
    const due = daysUntil(r.due_at, now);
    if (r.status === "invited") {
      return { ...base, tab: "answer", at: r.reply_by, week: daysUntil(r.reply_by, now) <= 7, tone: "b", tag: t("INVITATION"), detail: `${r.venue_short} · ${t("reply by {d}", { d: fmtDay(r.reply_by, t.intl) })}`,
        when: relDay(r.reply_by, now, t.intl), soon: daysUntil(r.reply_by, now) <= 2, cta: t("Respond"), href: `/reviews/invitations/${r.assignment_id}` };
    }
    if (r.status === "accepted") {
      const r2 = r.round > 1;
      return { ...base, tab: "write", at: r.due_at, week: due <= 7, tone: "a", tag: r2 ? t("ROUND 2") : t("IN PROGRESS"),
        detail: `${r.venue_short} · ${r2 ? t("revised paper") : r.draft_scores ? t("draft saved") : t("not started")} · ${t("due {d}", { d: fmtDay(r.due_at, t.intl) })}`,
        when: due < 0 ? t("overdue") : relDay(r.due_at, now, t.intl), soon: due <= 3,
        cta: r2 || !r.draft_scores ? t("Start") : t("Continue"), href: r2 ? `/reviews/${r.assignment_id}/round-2` : `/reviews/${r.assignment_id}` };
    }
    if (r.status === "submitted" && !r.decision_released && r.discussion_posts > 0) {
      return { ...base, tab: "write", at: r.submitted_at ?? r.due_at, week: false, tone: "b", tag: t("DISCUSSION"), detail: `${r.venue_short} · ${t("{n} messages", { n: r.discussion_posts })}`,
        when: r.submitted_at ? relDay(r.submitted_at, now, t.intl) : "", soon: false, cta: t("Join"), href: `/reviews/${r.assignment_id}/discussion` };
    }
    if (r.status === "submitted") {
      return { ...base, tab: "done", at: r.submitted_at ?? r.due_at, week: false, tone: "g", tag: r.decision_released ? t("DECIDED") : t("SUBMITTED"),
        detail: `${r.venue_short} · ${t("submitted {d}", { d: fmtDay(r.submitted_at, t.intl) })}`,
        when: r.submitted_at ? relDay(r.submitted_at, now, t.intl) : "", soon: false,
        cta: r.decision_released ? t("Check") : t("View"), href: r.decision_released ? `/reviews/${r.assignment_id}/decision` : `/reviews/${r.assignment_id}/submitted` };
    }
    const label = r.status === "expired" ? t("EXPIRED") : r.status === "handed_back" ? t("HANDED BACK") : r.status === "cancelled" ? t("CANCELLED") : t("DECLINED");
    return { ...base, tab: "declined", at: r.reply_by, week: false, tone: "n", tag: label, detail: r.venue_short, when: fmtDay(r.reply_by, t.intl), soon: false, cta: t("View"), href: `/reviews/invitations/${r.assignment_id}` };
  });

  return (
    <WorkspaceShell ctx={ctx} active="reviews">
      <Head kicker={t("Reviewer")} title={t("To review")} sub={t("Invitations to review, reviews in progress and everything you have submitted.")}
        right={<Link href="/settings/reviewing" className="text-[14px] text-[#2F5FD0] no-underline hover:underline">{t("Reviewer profile →")}</Link>} />
      <Cols
        main={<ReviewsList rows={rows} init={sp} />}
        aside={
          <>
            <section className={box}>
              <p className={kick}>{t("This year")}</p>
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                <div><div className="font-serif text-[28px] leading-none">{overview.submitted}</div><div className="text-[12px] text-[#4A5263]">{t("submitted")}</div></div>
                <div><div className="font-serif text-[28px] leading-none text-[#A8600F]">{overview.due}</div><div className="text-[12px] text-[#4A5263]">{t("due")}</div></div>
                <div><div className="font-serif text-[28px] leading-none">{overview.on_time_pct == null ? "—" : `${overview.on_time_pct}%`}</div><div className="text-[12px] text-[#4A5263]">{t("on time")}</div></div>
              </div>
              {certs.length ? (
                <div className="mt-3 flex flex-col gap-0.5">
                  {certs.map((c) => <a key={c.slug} href={`/api/reviews/certificate/${c.slug}`} className="text-[13px] text-[#2F5FD0]">{certs.length > 1 ? t("Reviewer certificate · {venue} →", { venue: c.short }) : t("Download reviewer certificate →")}</a>)}
                </div>
              ) : <p className="mb-0 mt-3 text-[13px] text-[#4A5263]">{t("Your certificate appears after your first submitted review.")}</p>}
            </section>
            <AvailabilityForm initial={{ availability: avail.availability, available_from: avail.available_from }} />
            {overview.bidding.map((b) => (
              <section key={b.slug} className="rounded-[8px] border border-[#F1D29A] bg-[#FFF6E6] px-4 py-3.5">
                <p className={kick}>{t("Bidding open")}</p>
                <p className="mb-2 mt-1.5 text-[14px]">
                  {b.closes_at ? t("{venue} · bid on papers before {d}.", { venue: b.name, d: fmtDay(b.closes_at, t.intl) }) : t("{venue} · bid on papers now.", { venue: b.name })}
                </p>
                <Link href={`/reviews/bidding/${b.slug}`} className="text-[14px] font-semibold text-[#0E1B3D]">{t("Bid now →")}</Link>
              </section>
            ))}
            <section className={box}>
              <p className={kick}>{t("Guides")}</p>
              <Link href="/help/reviewers/workflow" className={asideLink}>{t("From invitation to decision")}</Link>
              <Link href="/help/reviewers/blind-review" className={asideLink}>{t("Blind review: what stays hidden")}</Link>
              <Link href="/help/reviewers/conflicts" className={asideLink}>{t("Conflicts of interest")}</Link>
              <Link href="/help/reviewers/ai-tools" className={asideLink}>{t("Using AI tools in reviews")}</Link>
              <Link href="/help/reviewers/extensions" className={asideLink}>{t("More time, or handing a review back")}</Link>
              <Link href="/help/reviewers" className={`${asideLink} font-semibold`}>{t("All reviewer guides →")}</Link>
            </section>
          </>
        }
      />
    </WorkspaceShell>
  );
}

/** Canvas RV01-Reviews. */
export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Reveal fallback={<ReviewSkeleton variant="list" />}>
      <Inner searchParams={searchParams} />
    </Reveal>
  );
}
