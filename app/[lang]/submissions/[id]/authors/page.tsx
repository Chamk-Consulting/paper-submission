import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { SubmissionFrame, requireCtx } from "@/components/submission/frame";
import { AuthorsForm, type Row } from "@/components/submission/authors-form";
import { asideCard, kicker, noteBlue } from "@/components/submission/shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Authors") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "authors");
  const t = await getT();
  const rows: Row[] = ctx.authors.map((a) => ({
    key: a.personId, personId: a.personId, name: a.name, institution: a.institution, corresponding: a.corresponding, isYou: a.isYou, invite: !a.hasAccount,
    sub: [a.institution, a.isYou ? a.plenaryId : a.email].filter(Boolean).join(" · "),
  }));
  const insts = [...new Set(ctx.authors.map((a) => a.institution).filter(Boolean))] as string[];
  return (
    <SubmissionFrame ctx={ctx} step="authors" aside={
      <>
        <section className="overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
          <div className={`${kicker} border-b border-[#DADDE3] bg-[#FBFBF9] px-[18px] py-2.5`}>{t("Byline in the program")}</div>
          <div className="px-[18px] py-4">
            <div className="font-serif text-[17px] leading-[1.35]">{ctx.authors.map((a) => `${a.name}${a.institution ? ` ${insts.indexOf(a.institution) + 1}` : ""}`).join(", ")}</div>
            <ol className="mb-0 mt-2 pl-5 text-[13px] text-[#4A5263]">{insts.map((i) => <li key={i}>{i}</li>)}</ol>
          </div>
        </section>
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">{t("How co-authors are handled")}</h3>
          <ul className="mb-0 mt-2.5 flex flex-col gap-1.5 pl-5 text-[15px]">
            <li>{t("Everyone can see the paper and its status once they sign in.")}</li>
            <li>{t("You can submit before they confirm.")}</li>
            <li>{t("The author list is locked at the deadline — changes after that go to the program chair.")}</li>
          </ul>
        </section>
        <div className={noteBlue}><strong>{t("Conflicts come from this list.")}</strong> {t("Your co-authors' institutions are excluded from reviewing automatically.")}</div>
      </>
    }>
      <AuthorsForm id={id} initial={rows} />
    </SubmissionFrame>
  );
}

/** Canvas SB03-Authors. */
export default function Page(props: P) {
  return <Suspense fallback={<div className="min-h-dvh bg-[#F5F6F3]" aria-busy="true" />}><Inner {...props} /></Suspense>;
}
