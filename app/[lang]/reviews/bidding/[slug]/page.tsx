import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace/shell";
import { Reveal } from "@/components/motion/reveal";
import { ReviewSkeleton } from "@/components/skeletons/review";
import { Bidding } from "@/components/review/bidding";
import { Banner, Crumbs, Head, Tag } from "@/components/review/parts";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { getBidding } from "@/lib/review/data";
import { countdown, fmtDay } from "@/lib/review/shared";
import { getT } from "@/lib/i18n/server";
import { nowMs } from "@/lib/review/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Bid on papers") };
}

async function Inner({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getWorkspaceCtx();
  if (!ctx) redirect(`/sign-in?next=/reviews/bidding/${encodeURIComponent(slug)}`);
  const [data, t] = await Promise.all([getBidding(slug), getT()]);
  const crumbs = <Crumbs items={[[t("Reviews"), "/reviews"], [t("Bidding"), null]]} />;
  if (!data) {
    return (
      <WorkspaceShell ctx={ctx} active="reviews">
        {crumbs}
        <Head title={t("Bid on papers")} />
        <div className="mt-5 max-w-[680px]"><Banner tone="info">{t("Bidding isn't available for you at this venue. Only reviewers and associate editors of the event can bid.")}</Banner></div>
      </WorkspaceShell>
    );
  }
  const { venue, papers } = data;
  const left = venue.closes_at ? countdown(venue.closes_at, nowMs()) : null;
  return (
    <WorkspaceShell ctx={ctx} active="reviews">
      {crumbs}
      <Head
        title={t("Bid on papers · {venue}", { venue: venue.name })}
        sub={t("Tell the chairs which papers you'd like to review. Bids guide assignment; they don't guarantee it.")}
        right={venue.open
          ? venue.closes_at ? <Tag tone="a">{t("BIDDING CLOSES {d}", { d: fmtDay(venue.closes_at, t.intl) })}{left ? ` · ${left}` : ""}</Tag> : <Tag tone="g">{t("BIDDING OPEN")}</Tag>
          : <Tag tone="n">{t("BIDDING CLOSED")}</Tag>}
      />
      {!venue.open ? <div className="mt-4"><Banner tone="info">{t("Bidding is closed. Your bids are shown read-only.")}</Banner></div> : null}
      {/* TODO(review): "Best match" ordering needs topic-match scores; papers are shown by number for now. */}
      <Bidding papers={papers} open={venue.open} />
    </WorkspaceShell>
  );
}

/** Canvas RV10-Bidding. */
export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Reveal fallback={<ReviewSkeleton variant="list" />}>
      <Inner params={params} />
    </Reveal>
  );
}
