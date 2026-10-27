import Link from "@/components/site/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireCtx } from "@/components/submission/frame";
import { asideCard, card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import { FlowFrame, no4, steps } from "@/components/submission/followup/flow-frame";
import { LocalDate } from "@/components/submission/followup/due-pill";
import { NextSteps } from "@/components/submission/followup/next-steps";
import { WITHDRAW_REASONS } from "@/lib/submission/followup-shared";
import { loadInfo } from "@/lib/submission/followup-data";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Paper withdrawn") };
}
type P = { params: Promise<{ id: string }>; searchParams: Promise<{ r?: string }> };

async function Inner({ params, searchParams }: P) {
  const { id } = await params;
  const { r } = await searchParams;
  const ctx = await requireCtx(id, "status");
  const t = await getT();
  if (ctx.sub.stage !== "withdrawn") redirect(`/submissions/${id}`);
  const info = await loadInfo(id);
  const reason = WITHDRAW_REASONS.find(([k]) => k === info?.withdrawReason)?.[1] ?? "Other";
  const receipt = r && /^PLN-[\w-]{4,40}$/.test(r) ? r : null;
  const row = "flex flex-col gap-0.5";
  const generatedAt = new Date().toISOString();
  return (
    <FlowFrame
      ctx={ctx} crumb={t("Withdraw")} title={t("Paper withdrawn")}
      flow={{ name: t("Withdrawn"), mark: 23, steps: steps([[t("Reason"), ""], [t("Confirm"), ""]], -1, 1), note: t("This paper is closed.") }}
      aside={
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">{t("Email sent")}</h3>
          <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("A copy of this notice went to your co-authors, and the program chair was told in Plenary.")}</p>
        </section>
      }
    >
      <section className={card}>
        <p className="m-0 font-mono text-[12px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Withdrawn")} · {ctx.sub.withdrawnAt ? <LocalDate at={ctx.sub.withdrawnAt} generatedAt={generatedAt} time /> : null}</p>
        <h2 className={`${h2} mt-2`}>{t("{no} has been withdrawn", { no: no4(ctx.sub.number) })}</h2>
        <p className="mt-1 text-[#4A5263]">{t("The paper has left review. Your co-authors and the program chair have been told.")}</p>
        <div className="mt-4 grid gap-4 rounded-[8px] bg-[#F7F8F6] p-4 sm:grid-cols-4">
          <div className={row}><span className="text-[13px] text-[#4A5263]">{t("Paper")}</span><span className="font-semibold">{no4(ctx.sub.number)}</span></div>
          <div className={row}><span className="text-[13px] text-[#4A5263]">{t("Reason")}</span><span className="font-semibold">{t(reason)}</span></div>
          <div className={row}><span className="text-[13px] text-[#4A5263]">{t("Reviews")}</span><span className="font-semibold">{t("{c} cancelled, {k} kept on file", { c: info?.reviews.cancelled ?? 0, k: info?.reviews.submitted ?? 0 })}</span></div>
          {receipt ? <div className={row}><span className="text-[13px] text-[#4A5263]">{t("Receipt")}</span><span className="font-mono font-semibold">{receipt}</span></div> : null}
        </div>
      </section>
      <NextSteps title={t("What happens next")} doneLabel={t("Done")} items={[
        { title: t("Withdrawn"), text: t("The PDF is no longer shared with anyone."), done: true },
        { title: t("Kept in your history"), text: t("Listed as \"Withdrawn\" in My workspace.") },
        { title: t("Submit later"), text: t("Start a new submission at another venue when you are ready.") },
      ]} />
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/workspace/submissions" className={primaryBtn}>{t("Back to My workspace")}</Link>
        <Link href="/events" className={ghostBtn}>{t("Find another venue")}</Link>
      </div>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={2} rows={2} />}><Inner {...props} /></Reveal>;
}
