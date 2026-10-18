import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmissionFrame, requireCtx } from "@/components/submission/frame";
import { FilesStep } from "@/components/submission/files-step";
import { asideCard, kicker } from "@/components/submission/shell";
import { parsePageLimit } from "@/lib/submission/pdf-check";

export const metadata: Metadata = { title: "Upload PDF" };
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "files");
  const type = ctx.venue.details.types?.find((t) => t.name === ctx.sub.paperType);
  const limitText = type?.length ?? ctx.venue.pageLimit;
  const lim = parsePageLimit(limitText);
  const paper = ctx.files.find((f) => f.role === "paper" && f.current);
  const pages = paper?.pages ?? 0;
  return (
    <SubmissionFrame ctx={ctx} step="files" aside={
      <>
        {lim ? (
          <section className={asideCard}>
            <p className={kicker}>Page budget</p>
            <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
              {Array.from({ length: lim.included + lim.extra }, (_, i) => (
                <span key={i} className="h-[30px] w-[26px] rounded-[2px]" style={i < Math.min(pages, lim.included) ? { background: "#0E1B3D" } : i < pages ? { background: "#F2A93B" } : { border: `1.5px dashed ${i < lim.included ? "#B7BDC9" : "#F2A93B"}` }} />
              ))}
            </div>
            <p className="mb-0 mt-2.5 text-[14px] text-[#4A5263]">{paper ? `${pages} pages: ${Math.min(pages, lim.included)} included${pages > lim.included ? ` + ${pages - lim.included} extra (fee)` : ""}.` : `${lim.included} pages included${lim.extra ? ` + up to ${lim.extra} extra (fee)` : ""}.`}</p>
          </section>
        ) : null}
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">Fixing common problems</h3>
          <ul className="mb-0 mt-2.5 flex flex-col gap-1.5 pl-5 text-[15px]">
            <li><strong>Fonts not embedded:</strong> in Word, Save as PDF → &quot;PDF/A&quot;. In LaTeX, use pdflatex.</li>
            <li><strong>Names in the PDF:</strong> remove them from the title block and the file properties.</li>
            <li><strong>Wrong page size:</strong> start from the venue template.</li>
          </ul>
        </section>
      </>
    }>
      <FilesStep id={id} files={ctx.files} canContinue={ctx.done.files} typeLine={`${ctx.sub.paperType}${limitText ? ` · ${limitText}` : ""}`} />
    </SubmissionFrame>
  );
}

/** Canvas SB05-Upload. */
export default function Page(props: P) {
  return <Suspense fallback={<div className="min-h-dvh bg-[#F5F6F3]" aria-busy="true" />}><Inner {...props} /></Suspense>;
}
