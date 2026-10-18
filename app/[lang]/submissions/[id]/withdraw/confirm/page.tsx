import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireCtx } from "@/components/submission/frame";
import { asideCard, card, h2 } from "@/components/submission/shell";
import { FlowFrame, STAGE_TAG, no4, steps } from "@/components/submission/followup/flow-frame";
import { WITHDRAW_REASONS, WithdrawConfirmForm } from "@/components/submission/followup/withdraw-forms";
import { loadInfo } from "@/lib/submission/followup-data";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Confirm withdrawal") };
}
type P = { params: Promise<{ id: string }>; searchParams: Promise<{ reason?: string; note?: string }> };

async function Inner({ params, searchParams }: P) {
  const { id } = await params;
  const { reason = "", note = "" } = await searchParams;
  const ctx = await requireCtx(id, "status");
  const t = await getT();
  const base = `/submissions/${id}`;
  if (ctx.sub.stage === "withdrawn") redirect(`${base}/withdraw/done`);
  if (["draft", "done", "rejected"].includes(ctx.sub.stage)) redirect(base);
  const label = WITHDRAW_REASONS.find(([k]) => k === reason)?.[1];
  if (!label) redirect(`${base}/withdraw`);
  const info = await loadInfo(id);
  const reviews = info ? info.reviews.submitted + info.reviews.active : 0;
  const coauthors = ctx.authors.filter((a) => !a.isYou).length;
  const number = String(ctx.sub.number ?? 0).padStart(4, "0");
  const told = [t("Program chair"), reviews ? t(reviews === 1 ? "{n} reviewer" : "{n} reviewers", { n: reviews }) : null, coauthors ? t(coauthors === 1 ? "{n} co-author" : "{n} co-authors", { n: coauthors }) : null].filter(Boolean).join(", ");
  const row = "grid gap-1 border-b border-[#EEF0EC] py-3 sm:grid-cols-[160px_1fr]";
  return (
    <FlowFrame
      ctx={ctx} crumb={t("Withdraw")} title={t("Confirm withdrawal")}
      flow={{ name: t("Withdraw"), mark: 22, steps: steps([[t("Reason"), `${base}/withdraw?reason=${reason}`], [t("Confirm"), ""]], 1), note: t("This is the last step.") }}
      aside={
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">{t("Instead of withdrawing")}</h3>
          <ul className="mb-0 mt-2.5 flex list-none flex-col gap-2 p-0 text-[15px]">
            {ctx.editable ? <li><Link href={`${base}/edit`} className="text-[#2F5FD0]">{t("Fix the paper before the deadline")}</Link></li> : null}
            {/* TODO(inbox): link to the chair thread once IN01 lands. */}
            <li><Link href={`/submissions/${id}/message?about=withdraw`} className="text-[#2F5FD0]">{t("Message the program chair")}</Link></li>
          </ul>
        </section>
      }
    >
      <section className={card}>
        <h2 className={h2}>{t("Confirm withdrawal")}</h2>
        <p className="mt-2 text-[15px] font-semibold">{t("Paper {no}", { no: no4(ctx.sub.number) })} · <span className="font-normal">{ctx.sub.title}</span></p>
        <div className="mt-3 border-t border-[#EEF0EC]">
          <div className={row}><span className="text-[14px] text-[#4A5263]">{t("Current stage")}</span><span>{t(STAGE_TAG[ctx.sub.stage] ?? ctx.sub.stage)}{info && reviews ? ` · ${t("{n} of {total} reviews in", { n: info.reviews.submitted, total: reviews })}` : ""}</span></div>
          <div className={row}><span className="text-[14px] text-[#4A5263]">{t("Reason")}</span><span>{t(label!)} · <Link href={`${base}/withdraw?reason=${reason}${note ? `&note=${encodeURIComponent(note)}` : ""}`} className="text-[#2F5FD0]">{t("Change")}</Link></span></div>
          {note ? <div className={row}><span className="text-[14px] text-[#4A5263]">{t("Note")}</span><span className="whitespace-pre-line">{note}</span></div> : null}
          <div className={row}><span className="text-[14px] text-[#4A5263]">{t("Who is told")}</span><span>{told}</span></div>
        </div>
        <WithdrawConfirmForm id={id} reason={reason} note={note} number={number} />
      </section>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={2} rows={3} />}><Inner {...props} /></Reveal>;
}
