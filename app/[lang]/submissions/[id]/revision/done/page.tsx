import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { asideCard, card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import { FlowFrame, no4 } from "@/components/submission/followup/flow-frame";
import { loadRevisionFlow, revisionFlow } from "@/components/submission/followup/revision-shared";
import { NextSteps } from "@/components/submission/followup/next-steps";
import { LocalDate } from "@/components/submission/followup/due-pill";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Revision submitted") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const f = await loadRevisionFlow(id, { allowSubmitted: true });
  const t = await getT();
  const { ctx, revision } = f;
  if (!f.done.submitted || !revision) redirect(`/submissions/${id}/revision`);
  const row = "flex flex-col gap-0.5";
  return (
    <FlowFrame ctx={ctx} crumb={t("Revision")} title={t("Revision submitted")} flow={await revisionFlow(f, -1)}
      aside={
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">{t("Receipt")}</h3>
          <p className="mt-1.5 font-mono text-[15px]">{revision.receipt}</p>
        </section>
      }
    >
      <section className={card}>
        <p className="m-0 font-mono text-[12px] uppercase tracking-[0.06em] text-[#14603F]">✓ {t("Submitted")}{revision.submittedAt ? <> · <LocalDate at={revision.submittedAt} generatedAt={new Date().toISOString()} time /></> : null}</p>
        <h2 className={`${h2} mt-2`}>{t("Revision submitted")}</h2>
        <p className="mt-1 text-[#4A5263]">{t("The associate editor has your responses and the revised paper.")}</p>
        <div className="mt-4 grid gap-4 rounded-[8px] bg-[#F7F8F6] p-4 sm:grid-cols-3">
          <div className={row}><span className="text-[13px] text-[#4A5263]">{t("Paper")}</span><span className="font-semibold">{no4(ctx.sub.number)}</span></div>
          <div className={row}><span className="text-[13px] text-[#4A5263]">{t("Responses")}</span><span className="font-semibold">{t("{n} of {total} comments answered", { n: f.answered, total: f.items.length })}</span></div>
          <div className={row}><span className="text-[13px] text-[#4A5263]">{t("Receipt")}</span><span className="font-mono font-semibold">{revision.receipt}</span></div>
        </div>
      </section>
      <NextSteps title={t("What happens next")} doneLabel={t("Done")} items={[
        { title: t("Revision submitted"), text: t("The revised paper is checked like the first version."), done: true },
        { title: t("Editor check"), text: t("The associate editor reads your responses and may ask the reviewers."), },
        { title: t("Final decision"), text: t("You get an email when the decision is ready.") },
      ]} />
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/submissions/${id}`} className={primaryBtn}>{t("View status")}</Link>
        <Link href="/workspace/submissions" className={ghostBtn}>{t("My workspace")}</Link>
      </div>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={4} rows={2} />}><Inner {...props} /></Reveal>;
}
