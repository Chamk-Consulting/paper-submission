import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireCtx } from "@/components/submission/frame";
import { WorkspaceShell } from "@/components/workspace/shell";
import { getWorkspaceCtx } from "@/lib/workspace/data";
import { asideCard } from "@/components/submission/shell";
import { no4 } from "@/components/submission/followup/flow-frame";
import { Countdown } from "@/components/submission/followup/due-pill";
import { OpenViewer } from "@/components/submission/followup/open-viewer";
import { RebuttalForm } from "@/components/submission/followup/rebuttal-confirm-forms";
import { loadRebuttal } from "@/lib/submission/followup-data";
import { fmtAoE } from "@/lib/venues/time";
import { Reveal } from "@/components/motion/reveal";
import { WorkspaceFormSkeleton } from "@/components/skeletons/author";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Respond to the reviews") };
}
const isFuture = (iso: string) => Date.parse(iso) > Date.now();
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "status");
  const [ws, reviews] = await Promise.all([getWorkspaceCtx(), loadRebuttal(id)]);
  const t = await getT();
  const base = `/submissions/${id}`;
  if (!reviews.length) redirect(base);
  const closes = reviews[0].closesAt;
  const open = isFuture(closes) && !["withdrawn", "rejected", "done"].includes(ctx.sub.stage);
  const paper = ctx.files.find((f) => f.role === "paper" && f.current);
  return (
    <WorkspaceShell ctx={ws} active="submissions">
      <p className="m-0 text-[14px] text-[#4A5263]"><Link href="/workspace/submissions" className="text-[#121826] underline">{t("My submissions")}</Link> / <Link href={base} className="text-[#121826] underline">{no4(ctx.sub.number)}</Link> / {t("Rebuttal")}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-serif text-[34px] font-normal leading-[1.15]">{t("Respond to the reviews · {no}", { no: no4(ctx.sub.number) })}</h1>
          <p className="mt-1.5 max-w-[680px] text-[15px] text-[#4A5263]">{t("Before the decision, you can correct misunderstandings. Reviewers and the editor read this; it isn't a revision.")}</p>
        </div>
        <div className={`rounded-[6px] border px-3 py-2 text-[14px] ${open ? "border-[#F1D29A] bg-[#FFF6E6] text-[#3B2A07]" : "border-[#F3C3BE] bg-[#FDECEA] text-[#5C1A15]"}`}>
          <span className="font-mono font-semibold uppercase">{open ? t("Closes") : t("Closed")}</span> {fmtAoE(closes, t.intl)}{open ? <> · <Countdown at={closes} generatedAt={new Date().toISOString()} /></> : null}
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-auto">
          <RebuttalForm id={id} open={open} reviews={reviews.map((r) => ({ assignmentId: r.assignmentId, label: t("Reviewer {n}", { n: r.label.replace(/\D+/g, "") || "?" }), scores: Object.entries(r.scores), review: r.toAuthors, response: r.response }))} />
        </div>
        <aside className="flex w-full flex-col gap-4 lg:w-[300px] lg:flex-none">
          <section className={asideCard}>
            <h3 className="m-0 text-[17px] font-semibold">{t("Good rebuttals")}</h3>
            <ul className="mb-0 mt-2 flex flex-col gap-1.5 pl-5 text-[15px]">
              <li>{t("Answer factual errors with page and line.")}</li>
              <li>{t("Don't promise big new experiments.")}</li>
              <li>{t("Be brief and polite — reviewers can change scores.")}</li>
            </ul>
          </section>
          <section className={asideCard}>
            <h3 className="m-0 text-[17px] font-semibold">{t("Rules")}</h3>
            <p className="mt-1.5 text-[15px] text-[#4A5263]">{t("Max 2,000 characters per reviewer. No new PDF. Reviewer names stay hidden. You can edit until the deadline.")}</p>
          </section>
          {paper ? (
            <section className={asideCard}>
              <h3 className="m-0 text-[17px] font-semibold">{t("Translate")}</h3>
              <OpenViewer id={id} files={[paper]} tab="translate" label={t("Read the paper in another language")} className="mt-1.5 p-0 text-left text-[15px] text-[#2F5FD0] hover:underline" />
            </section>
          ) : null}
        </aside>
      </div>
    </WorkspaceShell>
  );
}

export default function Page(props: P) {
  return <Reveal fallback={<WorkspaceShell ctx={null} active="submissions"><WorkspaceFormSkeleton /></WorkspaceShell>}><Inner {...props} /></Reveal>;
}
