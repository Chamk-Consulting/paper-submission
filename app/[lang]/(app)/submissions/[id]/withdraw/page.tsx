import Link from "@/components/site/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireCtx } from "@/components/submission/frame";
import { asideCard } from "@/components/submission/shell";
import { FlowFrame, steps } from "@/components/submission/followup/flow-frame";
import { WithdrawReasonForm } from "@/components/submission/followup/withdraw-forms";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Withdraw paper") };
}
type P = { params: Promise<{ id: string }>; searchParams: Promise<{ reason?: string; note?: string }> };

async function Inner({ params, searchParams }: P) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx(id, "status");
  const t = await getT();
  if (ctx.sub.stage === "withdrawn") redirect(`/submissions/${id}/withdraw/done`);
  if (["draft", "done", "rejected"].includes(ctx.sub.stage)) redirect(`/submissions/${id}`);
  const base = `/submissions/${id}`;
  return (
    <FlowFrame
      ctx={ctx} crumb={t("Withdraw")} title={t("Withdraw paper")}
      flow={{ name: t("Withdraw"), mark: 21, steps: steps([[t("Reason"), `${base}/withdraw`], [t("Confirm"), ""]], 0), note: t("Nothing happens until you confirm on the next step.") }}
      aside={
        <>
          <section className={asideCard}>
            <h3 className="m-0 text-[17px] font-semibold">{t("What happens")}</h3>
            <ul className="mb-0 mt-2.5 flex flex-col gap-1.5 pl-5 text-[15px]">
              <li>{t("Reviewers and the editor are told; open reviews are cancelled.")}</li>
              <li>{t("Co-authors get an email with your reason.")}</li>
              <li>{t("The paper stays in your history as \"Withdrawn\". The PDF is no longer shared.")}</li>
            </ul>
          </section>
          {ctx.editable ? (
            <section className={asideCard}>
              <h3 className="m-0 text-[17px] font-semibold">{t("Not sure?")}</h3>
              <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("If you only need to fix something, edit the paper instead — that is open until the deadline.")} <Link href={`${base}/edit`} className="text-[#2F5FD0]">{t("Edit the paper")}</Link></p>
            </section>
          ) : null}
        </>
      }
    >
      <WithdrawReasonForm id={id} reason={sp.reason} note={sp.note} stage={ctx.sub.stage} />
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={2} rows={2} />}><Inner {...props} /></Reveal>;
}
