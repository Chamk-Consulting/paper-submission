import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { SubmissionFrame, requireCtx } from "@/components/submission/frame";
import { FilesStep } from "@/components/submission/files-step";
import { asideCard, kicker } from "@/components/submission/shell";
import { parsePageLimit } from "@/lib/submission/pdf-check";
import { Reveal } from "@/components/motion/reveal";
import { WizardSkeleton } from "@/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Upload PDF") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "files");
  const t = await getT();
  const type = ctx.venue.details.types?.find((ty) => ty.name === ctx.sub.paperType);
  const limitText = type?.length ?? ctx.venue.pageLimit;
  const lim = parsePageLimit(limitText);
  const paper = ctx.files.find((f) => f.role === "paper" && f.current);
  const pages = paper?.pages ?? 0;
  return (
    <SubmissionFrame ctx={ctx} step="files" aside={
      <>
        {lim ? (
          <section className={asideCard}>
            <p className={kicker}>{t("Page budget")}</p>
            <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
              {Array.from({ length: lim.included + lim.extra }, (_, i) => (
                <span key={i} className="h-[30px] w-[26px] rounded-[2px]" style={i < Math.min(pages, lim.included) ? { background: "#0E1B3D" } : i < pages ? { background: "#F2A93B" } : { border: `1.5px dashed ${i < lim.included ? "#B7BDC9" : "#F2A93B"}` }} />
              ))}
            </div>
            <p className="mb-0 mt-2.5 text-[14px] text-[#4A5263]">{paper
              ? (pages > lim.included ? t("{n} pages: {inc} included + {extra} extra (fee).", { n: pages, inc: lim.included, extra: pages - lim.included }) : t("{n} pages: {inc} included.", { n: pages, inc: Math.min(pages, lim.included) }))
              : (lim.extra ? t("{inc} pages included + up to {extra} extra (fee).", { inc: lim.included, extra: lim.extra }) : t("{inc} pages included.", { inc: lim.included }))}</p>
          </section>
        ) : null}
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">{t("Fixing common problems")}</h3>
          <ul className="mb-0 mt-2.5 flex flex-col gap-1.5 pl-5 text-[15px]">
            <li><strong>{t("Fonts not embedded:")}</strong> {t("in Word, Save as PDF → \"PDF/A\". In LaTeX, use pdflatex.")}</li>
            <li><strong>{t("Names in the PDF:")}</strong> {t("remove them from the title block and the file properties.")}</li>
            <li><strong>{t("Wrong page size:")}</strong> {t("start from the venue template.")}</li>
          </ul>
        </section>
      </>
    }>
      <FilesStep id={id} files={ctx.files} canContinue={ctx.done.files} typeLine={`${t(ctx.sub.paperType)}${limitText ? ` · ${t(limitText)}` : ""}`} />
    </SubmissionFrame>
  );
}

/** Canvas SB05-Upload. */
export default function Page(props: P) {
  return <Reveal fallback={<WizardSkeleton step="files" />}><Inner {...props} /></Reveal>;
}
