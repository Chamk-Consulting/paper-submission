import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireCtx } from "@/components/submission/frame";
import { asideCard, card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import { FlowFrame, no4, steps } from "@/components/submission/followup/flow-frame";
import { NextSteps } from "@/components/submission/followup/next-steps";
import { LocalDate } from "@/components/submission/followup/due-pill";
import { FIELD_LABEL, loadVersions } from "@/lib/submission/followup-data";
import { Reveal } from "@/components/motion/reveal";
import { FlowSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Changes saved") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "status");
  const t = await getT();
  const base = `/submissions/${id}`;
  const v = (await loadVersions(id)).find((x) => x.kind === "edit");
  if (!v) redirect(`${base}/edit`);
  const coauthors = ctx.authors.filter((a) => !a.isYou).length;
  const row = "flex flex-col gap-0.5";
  return (
    <FlowFrame
      ctx={ctx} crumb={t("Edit")} title={t("Changes saved")} due={ctx.editable ? { at: ctx.venue.deadline, kind: "edit" } : null}
      flow={{ name: t("Edit"), mark: 13, steps: steps([[t("Make changes"), ""], [t("Review & save"), ""], [t("Saved"), ""]], 2), note: t("You can edit again until the deadline.") }}
      aside={
        <section className={asideCard}>
          <h3 className="m-0 text-[17px] font-semibold">{t("Receipt")}</h3>
          <p className="mt-1.5 font-mono text-[15px]">{v.receipt}</p>
          <p className="mt-1 text-[14px] text-[#4A5263]">{t("Keep it for your records — the program chair can look it up.")}</p>
        </section>
      }
    >
      <section className={card}>
        <p className="m-0 font-mono text-[12px] uppercase tracking-[0.06em] text-[#14603F]">✓ {t("Saved")} · <LocalDate at={v.createdAt} generatedAt={new Date().toISOString()} time /></p>
        <h2 className={`${h2} mt-2`}>{t("{no} is now version {n}", { no: no4(ctx.sub.number), n: v.no })}</h2>
        <div className="mt-4 grid gap-4 rounded-[8px] bg-[#F7F8F6] p-4 sm:grid-cols-3">
          <div className={row}><span className="text-[13px] text-[#4A5263]">{t("Changed")}</span><span className="font-semibold">{v.changed.map((c) => t(FIELD_LABEL[c] ?? c)).join(", ")}</span></div>
          <div className={row}><span className="text-[13px] text-[#4A5263]">{t("Co-authors")}</span><span className="font-semibold">{v.notified ? t("{n} notified by email", { n: coauthors }) : t("Not emailed")}</span></div>
          <div className={row}><span className="text-[13px] text-[#4A5263]">{t("Receipt")}</span><span className="font-mono font-semibold">{v.receipt}</span></div>
        </div>
      </section>
      <NextSteps title={t("What happens next")} doneLabel={t("Done")} items={[
        { title: t("Saved"), text: t("Version {n} replaces the previous one for reviewers.", { n: v.no }), done: true },
        { title: t("Deadline and lock"), text: t("You can keep editing until the deadline. Then the paper is locked for review.") },
        { title: t("Review"), text: t("Reviewers see the latest version only.") },
      ]} />
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={base} className={primaryBtn}>{t("View status")}</Link>
        {ctx.editable ? <Link href={`${base}/edit`} className={ghostBtn}>{t("Edit again")}</Link> : null}
        <Link href="/workspace/submissions" className={ghostBtn}>{t("My workspace")}</Link>
      </div>
    </FlowFrame>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<FlowSkeleton steps={3} rows={2} />}><Inner {...props} /></Reveal>;
}
