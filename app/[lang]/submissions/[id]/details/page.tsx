import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { SubmissionFrame, requireCtx } from "@/components/submission/frame";
import { DetailsForm } from "@/components/submission/details-form";
import { asideCard, kicker, noteBlue } from "@/components/submission/shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Paper details") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "details");
  const s = ctx.sub;
  const t = await getT();
  const byline = ctx.authors.map((a) => a.name).join(", ");
  return (
    <SubmissionFrame ctx={ctx} step="details" aside={
      <>
        <section className="overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
          <div className={`${kicker} border-b border-[#DADDE3] bg-[#FBFBF9] px-[18px] py-2.5`}>{t("How it will look in the program")}</div>
          <div className="px-[18px] py-4">
            <div className="font-mono text-[12px] text-[#4A5263]">[Session] · [Room] · [Time]</div>
            <div className="mt-1.5 font-serif text-[19px] leading-[1.25]">{s.shortTitle || (s.title === "Untitled paper" ? t("Your title appears here") : s.title)}</div>
            <div className="mt-1.5 text-[13px] text-[#4A5263]">{byline || t("Authors from step 3")}</div>
          </div>
        </section>
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">{t("Writing tips")}</h3>
          <ul className="mb-0 mt-2.5 flex flex-col gap-1.5 pl-5 text-[15px]">
            <li>{t("Title in sentence case; no abbreviations.")}</li>
            <li>{t("Abstract: problem, method, result — no citations or maths symbols that need LaTeX.")}</li>
            <li>{t("Paste from Word is fine — formatting is cleaned.")}</li>
          </ul>
        </section>
        <div className={noteBlue}><strong>{t("Reviewers see this title and abstract")}</strong> {t("when deciding whether to accept a review. Make the first sentence count.")}</div>
      </>
    }>
      <DetailsForm id={id} typeLine={[s.paperType, s.track].filter(Boolean).map((x) => t(x as string)).join(" · ")}
        initial={{ title: s.title, abstract: s.abstract ?? "", shortTitle: s.shortTitle ?? "", original: !!s.declarations.original, preprint: !!s.declarations.preprint, studentAward: !!s.declarations.student_award }} />
    </SubmissionFrame>
  );
}

/** Canvas SB02-Details. */
export default function Page(props: P) {
  return <Suspense fallback={<div className="min-h-dvh bg-[#F5F6F3]" aria-busy="true" />}><Inner {...props} /></Suspense>;
}
