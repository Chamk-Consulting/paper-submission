import Link from "next/link";
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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Reviews") };
}

async function Inner() {
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect("/sign-in?next=/reviews");
  const [reviews, overview, avail, t] = await Promise.all([getMyReviews(), getOverview(), getAvailability(ctx.me.person?.id), getT()]);
  const now = nowMs();

  const rows: Row[] = reviews.map((r) => {
    const base = { id: r.assignment_id, no: paperNo(r.paper_number), title: r.title };
    const due = daysUntil(r.due_at, now);
    if (r.status === "invited") {
      return { ...base, tab: "todo", tone: "b", tag: t("INVITATION"), detail: `${r.venue_short} · ${t("reply by {d}", { d: fmtDay(r.reply_by, t.intl) })}`,
        when: relDay(r.reply_by, now, t.intl), soon: daysUntil(r.reply_by, now) <= 2, cta: t("Respond"), href: `/reviews/invitations/${r.assignment_id}` };
    }
    if (r.status === "accepted") {
      const r2 = r.round > 1;
      return { ...base, tab: "todo", tone: "a", tag: r2 ? t("ROUND 2") : t("IN PROGRESS"),
        detail: `${r.venue_short} · ${r2 ? t("revised paper") : r.draft_scores ? t("draft saved") : t("not started")} · ${t("due {d}", { d: fmtDay(r.due_at, t.intl) })}`,
        when: due < 0 ? t("overdue") : relDay(r.due_at, now, t.intl), soon: due <= 3,
        cta: r2 || !r.draft_scores ? t("Start") : t("Continue"), href: r2 ? `/reviews/${r.assignment_id}/round-2` : `/reviews/${r.assignment_id}` };
    }
    if (r.status === "submitted" && !r.decision_released && r.discussion_posts > 0) {
      return { ...base, tab: "todo", tone: "b", tag: t("DISCUSSION"), detail: `${r.venue_short} · ${t("{n} messages", { n: r.discussion_posts })}`,
        when: r.submitted_at ? relDay(r.submitted_at, now, t.intl) : "", soon: false, cta: t("Join"), href: `/reviews/${r.assignment_id}/discussion` };
    }
    if (r.status === "submitted") {
      return { ...base, tab: "done", tone: "g", tag: r.decision_released ? t("DECIDED") : t("SUBMITTED"),
        detail: `${r.venue_short} · ${t("submitted {d}", { d: fmtDay(r.submitted_at, t.intl) })}`,
        when: r.submitted_at ? relDay(r.submitted_at, now, t.intl) : "", soon: false,
        cta: r.decision_released ? t("Check") : t("View"), href: r.decision_released ? `/reviews/${r.assignment_id}/decision` : `/reviews/${r.assignment_id}/submitted` };
    }
    const label = r.status === "expired" ? t("EXPIRED") : r.status === "handed_back" ? t("HANDED BACK") : r.status === "cancelled" ? t("CANCELLED") : t("DECLINED");
    return { ...base, tab: "declined", tone: "n", tag: label, detail: r.venue_short, when: fmtDay(r.reply_by, t.intl), soon: false, cta: t("View"), href: `/reviews/invitations/${r.assignment_id}` };
  });

  return (
    <WorkspaceShell ctx={ctx} active="reviews">
      <Head kicker={t("Reviewer")} title={t("Reviews")} sub={t("Invitations to review, reviews in progress and everything you have submitted.")}
        right={<Link href="/settings" className="text-[14px] text-[#2F5FD0] no-underline hover:underline">{t("Edit my review topics →")}</Link>} />
      <Cols
        main={<ReviewsList rows={rows} />}
        aside={
          <>
            <section className={box}>
              <p className={kick}>{t("This year")}</p>
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                <div><div className="font-serif text-[28px] leading-none">{overview.submitted}</div><div className="text-[12px] text-[#4A5263]">{t("submitted")}</div></div>
                <div><div className="font-serif text-[28px] leading-none text-[#A8600F]">{overview.due}</div><div className="text-[12px] text-[#4A5263]">{t("due")}</div></div>
                <div><div className="font-serif text-[28px] leading-none">{overview.on_time_pct == null ? "—" : `${overview.on_time_pct}%`}</div><div className="text-[12px] text-[#4A5263]">{t("on time")}</div></div>
              </div>
              {/* TODO(review): reviewer certificate PDF. */}
              <span aria-disabled title={t("Coming soon")} className="mt-3 block text-[13px] text-[#9AA3B5]">{t("Download reviewer certificate →")}</span>
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
              {/* TODO(help): reviewer guides (HP pages). */}
              <span aria-disabled title={t("Coming soon")} className={`${asideLink} text-[#9AA3B5]!`}>{t("Writing a useful review")}</span>
              <span aria-disabled title={t("Coming soon")} className={`${asideLink} text-[#9AA3B5]!`}>{t("Conflicts of interest")}</span>
              <span aria-disabled title={t("Coming soon")} className={`${asideLink} text-[#9AA3B5]!`}>{t("Using AI tools in reviews")}</span>
            </section>
          </>
        }
      />
    </WorkspaceShell>
  );
}

/** Canvas RV01-Reviews. */
export default function Page() {
  return (
    <Reveal fallback={<ReviewSkeleton variant="list" />}>
      <Inner />
    </Reveal>
  );
}
