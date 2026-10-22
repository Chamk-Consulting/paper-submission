import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireCtx } from "@/components/submission/frame";
import { asideCard } from "@/components/submission/shell";
import type { Flow } from "@/components/submission/followup/flow-frame";
import { loadFinal, loadInfo, loadRegistrations } from "@/lib/submission/followup-data";

/* Shared loading, rail and checklist of the final-version flow (SB12–SB12f). */

export async function loadFinalFlow(id: string) {
  const ctx = await requireCtx(id, "status");
  if (ctx.sub.stage !== "final" && ctx.sub.stage !== "done") redirect(`/submissions/${id}`);
  const [final, regs, info] = await Promise.all([loadFinal(id), loadRegistrations(id), loadInfo(id)]);
  const pdf = ctx.files.find((f) => f.role === "final" && f.current);
  const done = {
    pdf: !!pdf && pdf.check.status !== "failed",
    title: !!final?.lockedAt,
    copyright: final?.copyrightStatus === "signed",
    registration: regs.some((r) => r.coversPaper) && !!final?.presenterId,
    submitted: !!final?.submittedAt,
  };
  return { ctx, final, regs, info, pdf, done, due: info?.dates.finals ?? null };
}

type FF = Awaited<ReturnType<typeof loadFinalFlow>>;
const KEYS = ["pdf", "title", "copyright", "registration", "submitted"] as const;
const PATHS = ["final", "final/title-authors", "final/copyright", "final/registration", "final/review"];

export async function finalFlow(f: FF, current: number): Promise<Flow> {
  const t = await getT();
  const base = `/submissions/${f.ctx.sub.id}`;
  const labels = [t("Camera-ready PDF"), t("Title & authors"), t("Copyright"), t("Registration & presenter"), t("Review & submit")];
  return {
    name: t("Final version"), mark: 40 + current,
    steps: labels.map((label, i) => ({ label, href: `${base}/${PATHS[i]}`, state: i === current ? "current" : f.done[KEYS[i]] ? "done" : "todo" })),
    note: t("Your progress is saved. Come back any time before the deadline."),
  };
}

export async function FinalChecklist({ f, current }: { f: FF; current: number }) {
  const t = await getT();
  const items = [t("Camera-ready PDF"), t("Title & authors locked"), f.info?.copyrightMode === "ieee_ecf" ? t("IEEE copyright signed") : t("Copyright signed"), t("One author registered"), t("Review & submit")];
  return (
    <section className={asideCard}>
      <h3 className="m-0 text-[17px] font-semibold">{t("Final version checklist")}</h3>
      <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0 text-[15px]">
        {items.map((label, i) => {
          const ok = f.done[KEYS[i]];
          return <li key={label} className="flex gap-2"><span aria-hidden className={ok ? "text-[#14603F]" : i === current ? "text-[#F2A93B]" : "text-[#6B7385]"}>{ok ? "✓" : i === current ? "●" : "○"}</span><span className={ok ? "" : i === current ? "font-semibold" : "text-[#4A5263]"}>{label}</span></li>;
        })}
      </ul>
    </section>
  );
}
