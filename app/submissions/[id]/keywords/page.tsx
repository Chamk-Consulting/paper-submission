import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmissionFrame, requireCtx } from "@/components/submission/frame";
import { KeywordsForm } from "@/components/submission/keywords-form";
import { asideCard } from "@/components/submission/shell";
import { DEFAULT_KEYWORDS } from "@/lib/submission/data";

export const metadata: Metadata = { title: "Keywords" };
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "keywords");
  const groups = ctx.venue.details.keyword_groups?.length ? ctx.venue.details.keyword_groups : DEFAULT_KEYWORDS;
  return (
    <SubmissionFrame ctx={ctx} step="keywords" aside={
      <section className={asideCard}>
        <h3 className="m-0 text-[17px] font-semibold">Choosing well</h3>
        <ul className="mb-0 mt-2.5 flex flex-col gap-1.5 pl-5 text-[15px]">
          <li>Main keyword = the field your contribution belongs to, not the application.</li>
          <li>Use ★ to make any keyword the main one.</li>
          <li>Too broad (e.g. &quot;Control&quot;) makes reviewer matching weaker.</li>
        </ul>
        {/* TODO(review): reviewer-pool size per keyword once reviewers record their expertise. */}
      </section>
    }>
      <KeywordsForm id={id} venueName={ctx.venue.acr} groups={groups} initial={ctx.sub.keywords} own={ctx.sub.ownKeywords} />
    </SubmissionFrame>
  );
}

/** Canvas SB04-Keywords. */
export default function Page(props: P) {
  return <Suspense fallback={<div className="min-h-dvh bg-[#F5F6F3]" aria-busy="true" />}><Inner {...props} /></Suspense>;
}
