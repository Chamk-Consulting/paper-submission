import Link from "@/components/site/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import { FlowFrame, no4 } from "@/components/submission/followup/flow-frame";
import { RevisionAside, loadRevisionFlow, revisionFlow } from "@/components/submission/followup/revision-shared";
import { ChangeSummaryForm } from "@/components/submission/followup/revision-forms";
import { CheckList, FollowupUpload } from "@/components/submission/followup/bits";
import { OpenViewer } from "@/components/submission/followup/open-viewer";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";
import { pageLimitFor } from "@/lib/venues/window";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Revised files") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const f = await loadRevisionFlow(id);
  const t = await getT();
  const { ctx, files } = f;
  const base = `/submissions/${id}`;
  const original = ctx.files.find((x) => x.role === "paper" && x.current);
  const limit = await pageLimitFor(ctx.venue, ctx.sub.paperType);
  const sub = "mb-2 mt-5 flex flex-wrap items-baseline gap-2";
  const viewerFiles = [files.revision, files.highlighted, original].filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <FlowFrame ctx={ctx} crumb={t("Revision")} title={t("Revise and respond")} due={{ at: f.due, kind: "due" }} flow={await revisionFlow(f, 2)} aside={<RevisionAside f={f} />}>
      <section className={card}>
        <h2 className={h2}>{t("Upload the revised files")}</h2>
        <p className="mt-1 text-[#4A5263]">{t("The revised paper keeps ID {no}. It is checked the same way as the first version.", { no: no4(ctx.sub.number) })}</p>

        <p className={sub}><span className="font-semibold">{t("Revised paper")}</span><span className="rounded-[3px] bg-[#FDECEA] px-1.5 font-mono text-[11px] uppercase text-[#B3261E]">{t("Required")}</span><span className="text-[14px] text-[#4A5263]">{t("PDF")}{limit ? ` · ${t("Page limit: {limit}.", { limit })}` : ""}</span></p>
        <FollowupUpload id={id} role="revision" current={files.revision} label={t("Drop the revised PDF here")} hint={t("PDF only · up to 20 MB")}>
          {viewerFiles.length ? <OpenViewer id={id} files={viewerFiles} label={t("Open in viewer")} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px]" /> : null}
        </FollowupUpload>
        {files.revision ? <CheckList file={files.revision} /> : null}

        <p className={sub}><span className="font-semibold">{t("Highlighted version")}</span><span className="rounded-[3px] bg-[#E6EDFC] px-1.5 font-mono text-[11px] uppercase text-[#1F47A8]">{t("Recommended")}</span><span className="text-[14px] text-[#4A5263]">{t("Changes marked in colour")}</span></p>
        <FollowupUpload id={id} role="highlighted" current={files.highlighted} label={t("Drop the highlighted PDF here")} hint={t("PDF only · up to 20 MB")} />

        <p className={sub}><span className="font-semibold">{t("Supplementary material")}</span><span className="rounded-[3px] bg-[#EEF0EC] px-1.5 font-mono text-[11px] uppercase text-[#4A5263]">{t("Optional")}</span><span className="text-[14px] text-[#4A5263]">{t("PDF or ZIP · up to 50 MB")}</span></p>
        <FollowupUpload id={id} role="supplementary" current={files.supplementary} accept="application/pdf,.pdf,.zip,application/zip" maxMb={50} label={t("Drop a PDF or ZIP here")} />
      </section>

      <section className={`${card} mt-6`}>
        <h2 className={h2}>{t("What changed")}</h2>
        <p className="mt-1 text-[#4A5263]">{t("One line per change, with where it is and which comment it answers.")}{original && files.revision?.pages ? ` ${t("{a} → {b} pages", { a: original.pages ?? "?", b: files.revision.pages })}` : ""}</p>
        <ChangeSummaryForm id={id} items={(f.revision?.summary ?? []).map((s) => s.item)} />
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`${base}/revision/respond`} className={ghostBtn}>← {t("Responses")}</Link>
        {f.done.files ? <Link href={`${base}/revision/review`} className={primaryBtn}>{t("Review and submit")} →</Link> : <span aria-disabled="true" className={`${primaryBtn} opacity-50`}>{t("Review and submit")} →</span>}
      </div>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={4} cards={2} rows={2} />}><Inner {...props} /></Reveal>;
}
