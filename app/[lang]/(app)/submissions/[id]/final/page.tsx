import Link from "@/components/site/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { asideCard, card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import { FlowFrame } from "@/components/submission/followup/flow-frame";
import { FinalChecklist, finalFlow, loadFinalFlow } from "@/components/submission/followup/final-shared";
import { CheckList, FollowupUpload } from "@/components/submission/followup/bits";
import { checkSummary } from "@/lib/submission/followup-shared";
import { OpenViewer } from "@/components/submission/followup/open-viewer";
import { commentsOf, loadPaperReviews } from "@/lib/submission/followup-data";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";
import { pageLimitFor } from "@/lib/venues/window";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Final version") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const f = await loadFinalFlow(id);
  const t = await getT();
  const { ctx, pdf } = f;
  const base = `/submissions/${id}`;
  const comments = commentsOf(await loadPaperReviews(id));
  const firstPerReviewer = comments.filter((c) => c.no === 1);
  const { fails } = checkSummary(pdf);
  // Final versions may use the extra pages too, so the limit shown is the full "N + extra" of the type.
  const limit = await pageLimitFor(ctx.venue, ctx.sub.paperType);
  return (
    <FlowFrame ctx={ctx} crumb={t("Final version")} title={t("Final version")} due={{ at: f.due, kind: "due" }} flow={await finalFlow(f, 0)}
      aside={
        <>
          <FinalChecklist f={f} current={0} />
          <section className={asideCard}>
            <h3 className="m-0 text-[17px] font-semibold">{t("Why it matters")}</h3>
            <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("Papers without a signed copyright form and one registered author by the deadline are left out of the proceedings.")}</p>
          </section>
        </>
      }
    >
      <section className={card}>
        <h2 className={h2}>{t("Upload the camera-ready PDF")}</h2>
        <p className="mt-1 text-[#4A5263]">{t("Address the reviewers' comments, put the author names and affiliations back, and remove page numbers.")}{limit ? ` ${t("Page limit: {limit}.", { limit })}` : ""}</p>
        <div className="mt-4">
          <FollowupUpload id={id} role="final" current={pdf} label={t("Drop your final PDF here, or click to choose")} hint={t("PDF only · up to 20 MB · checked as soon as it uploads")}>
            {pdf ? <OpenViewer id={id} files={[pdf]} label={t("Preview")} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px]" /> : null}
          </FollowupUpload>
        </div>
        {pdf ? <CheckList file={pdf} /> : null}
        {fails ? <p role="alert" className="mt-3 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{t("Fix the problems above, then upload the PDF again.")}</p> : null}
      </section>
      {firstPerReviewer.length ? (
        <section className={`${card} mt-6`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className={h2}>{t("Reviewer comments to address")}</h2><Link href={`${base}/decision`} className="text-[15px] text-[#2F5FD0]">{t("Read all reviews")}</Link></div>
          <ul className="mb-0 mt-3 flex flex-col gap-2 pl-5 text-[15px]">
            {firstPerReviewer.map((c) => <li key={c.key}><span className="font-semibold">{c.ordinal}</span> — <span className="line-clamp-2 inline">{c.quote}</span></li>)}
          </ul>
        </section>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={base} className={ghostBtn}>← {t("Paper status")}</Link>
        {f.done.pdf ? <Link href={`${base}/final/title-authors`} className={primaryBtn}>{t("Continue to title & authors")} →</Link> : <span aria-disabled="true" className={`${primaryBtn} opacity-50`}>{t("Continue to title & authors")} →</span>}
      </div>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={5} cards={2} rows={1} />}><Inner {...props} /></Reveal>;
}
