import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { asideCard, card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import { FlowFrame, no4 } from "@/components/submission/followup/flow-frame";
import { finalFlow, loadFinalFlow } from "@/components/submission/followup/final-shared";
import { NextSteps } from "@/components/submission/followup/next-steps";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Final version submitted") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const f = await loadFinalFlow(id);
  const t = await getT();
  const { ctx, final } = f;
  if (!final?.submittedAt) redirect(`/submissions/${id}/final/review`);
  const complete = final.status === "complete";
  const flow = await finalFlow(f, -1);
  const row = "flex flex-col gap-0.5";
  return (
    <FlowFrame ctx={ctx} crumb={t("Final version")} title={t("Final version")} flow={flow}
      aside={
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">{t("Receipt")}</h3>
          <p className="mt-1.5 font-mono text-[15px]">{final.receipt}</p>
        </section>
      }
    >
      <section className={card}>
        <p className="m-0 font-mono text-[12px] uppercase tracking-[0.06em] text-[#14603F]">✓ {complete ? t("Complete") : t("Submitted")}</p>
        <h2 className={`${h2} mt-2`}>{complete ? t("You're in the proceedings") : t("Final version received")}</h2>
        <p className="mt-1 text-[#4A5263]">{complete ? t("{no} is complete: final PDF, copyright and registration are all in.", { no: no4(ctx.sub.number) }) : t("We still need the signed copyright form and one author registration before the deadline.")}</p>
        <div className="mt-4 grid gap-4 rounded-[8px] bg-[#F7F8F6] p-4 sm:grid-cols-3">
          <div className={row}><span className="text-[13px] text-[#4A5263]">{t("Paper")}</span><span className="font-semibold">{no4(ctx.sub.number)}</span></div>
          <div className={row}><span className="text-[13px] text-[#4A5263]">{t("Title")}</span><span className="line-clamp-2 font-semibold">{final.finalTitle ?? ctx.sub.title}</span></div>
          <div className={row}><span className="text-[13px] text-[#4A5263]">{t("Receipt")}</span><span className="font-mono font-semibold">{final.receipt}</span></div>
        </div>
      </section>
      <NextSteps title={t("What happens next")} doneLabel={t("Done")} items={[
        { title: t("Final version submitted"), text: t("The publication chair checks the PDF and the copyright form."), done: true },
        { title: t("Prepare your slides"), text: t("Upload them from the paper page once the program is published.") },
        { title: t("Present at the conference"), text: t("The presenter must attend; papers not presented are removed from the proceedings.") },
        { title: t("Published"), text: t("The paper appears in the proceedings after the conference.") },
      ]} />
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/submissions/${id}`} className={primaryBtn}>{t("View status")}</Link>
        <Link href="/workspace/submissions" className={ghostBtn}>{t("My workspace")}</Link>
      </div>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={5} rows={2} />}><Inner {...props} /></Reveal>;
}
