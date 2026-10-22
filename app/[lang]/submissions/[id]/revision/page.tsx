import Link from "@/components/site/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { asideCard, card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import { FlowFrame } from "@/components/submission/followup/flow-frame";
import { loadRevisionFlow, revisionFlow } from "@/components/submission/followup/revision-shared";
import { OpenViewer } from "@/components/submission/followup/open-viewer";
import { RECOMMENDATION } from "@/lib/submission/followup-data";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Revise and respond") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const f = await loadRevisionFlow(id);
  const t = await getT();
  const { ctx, reviews, decision } = f;
  const base = `/submissions/${id}`;
  const paper = ctx.files.find((x) => x.role === "paper" && x.current);
  return (
    <FlowFrame ctx={ctx} crumb={t("Revision")} title={t("Revise and respond")} due={{ at: f.due, kind: "due" }} flow={await revisionFlow(f, 0)}
      aside={
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">{t("Help")}</h3>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0 text-[15px]">
            {paper ? <li><OpenViewer id={id} files={[paper]} tab="ask" label={t("Ask the paper about a comment")} className="p-0 text-left text-[#2F5FD0] hover:underline" /></li> : null}
            {paper ? <li><OpenViewer id={id} files={[paper]} tab="translate" label={t("Translate the paper")} className="p-0 text-left text-[#2F5FD0] hover:underline" /></li> : null}
            <li><Link href={`${base}/decision`} className="text-[#2F5FD0]">{t("Read the decision letter")}</Link></li>
          </ul>
        </section>
      }
    >
      <section className={card}>
        <p className="m-0"><span className="rounded-[3px] bg-[#FBEFDD] px-2 py-0.5 font-mono text-[12px] uppercase tracking-[0.06em] text-[#7A4508]">{t("Conditionally accepted")}</span></p>
        <h2 className={`${h2} mt-3`}>{t("What the reviewers asked for")}</h2>
        <p className="mt-1 text-[#4A5263]">{t("Answer each comment, upload the revised paper, then submit. The associate editor reads your responses first.")}</p>
        {decision?.editorSummary ? <p className="mt-4 whitespace-pre-line rounded-[6px] bg-[#F7F8F6] px-4 py-3 text-[15px]"><span className="block font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Main concern (AE)")}</span>{decision.editorSummary}</p> : null}
        <ul className="m-0 mt-4 list-none p-0">
          {reviews.map((r, i) => (
            <li key={r.assignmentId} className="flex items-center justify-between gap-3 border-b border-[#EEF0EC] py-3 last:border-0">
              <span className="font-semibold">{t("Reviewer {n}", { n: r.label.replace(/\D+/g, "") || i + 1 })}</span>
              <span className="text-[14px] text-[#4A5263]">{t("{n} comments", { n: f.items.filter((c) => c.assignmentId === r.assignmentId).length })}{r.recommendation ? ` · ${t(RECOMMENDATION[r.recommendation] ?? r.recommendation)}` : ""}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={base} className={ghostBtn}>← {t("Paper status")}</Link>
        <Link href={`${base}/revision/respond`} className={primaryBtn}>{t("Respond to reviewers")} →</Link>
      </div>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={4} rows={3} />}><Inner {...props} /></Reveal>;
}
