import Link from "next/link";
import type { ReactNode } from "react";
import { WizardHeader, WizardLayout } from "@/components/submission/shell";
import { Pin } from "@/components/motion/pin";
import { StepMark } from "@/components/motion/step-transition";
import { DuePill, type DueKind } from "@/components/submission/followup/due-pill";
import { initialsOf } from "@/components/submission/frame";
import { getT } from "@/lib/i18n/server";
import type { Ctx } from "@/lib/submission/data";

/* Flow names, step labels and notes are passed already translated.
   Shared frame of the follow-up flows (canvas SB10–SB14): band with breadcrumb + due pill, rail with the
   paper card and the flow's steps, main column and aside. */

export type FlowStep = { label: string; href?: string; state: "done" | "current" | "todo" };
export type Flow = { name: string; steps: FlowStep[]; note?: string; mark: number };

export const STAGE_TAG: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  review: "Under review",
  decision: "Decision",
  revise: "Revision",
  final: "Accepted",
  done: "Published",
  rejected: "Not accepted",
  withdrawn: "Withdrawn",
};

export const no4 = (n: number | null) => `#${String(n ?? 0).padStart(4, "0")}`;

export function meName(ctx: Ctx) {
  return ctx.me.person ? `${ctx.me.person.given_name} ${ctx.me.person.family_name}`.trim() : ctx.me.email;
}

export async function FlowFrame({ ctx, crumb, title, due, flow, aside, children, wide = false }: {
  ctx: Ctx; crumb: ReactNode; title: string; due?: { at: string | null; kind: DueKind } | null; flow?: Flow | null; aside?: ReactNode; children: ReactNode; wide?: boolean;
}) {
  const t = await getT();
  const generatedAt = new Date(ctx.sub.updatedAt).toISOString();
  const no = no4(ctx.sub.number);
  const base = `/submissions/${ctx.sub.id}`;
  return (
    <WizardLayout
      header={<WizardHeader initials={initialsOf(meName(ctx), ctx.me.email)} />}
      band={
        <Pin name="wz-band">
          <div className="border-b border-[#DADDE3] bg-white">
            <div className="flex flex-col gap-3 px-5 pb-5 pt-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="m-0 text-[14px] text-[#4A5263]">
                  <Link href="/workspace/submissions" className="text-[#121826] underline">{t("My workspace")}</Link> / <Link href={base} className="text-[#121826] underline">{no}</Link> / {crumb}
                </p>
                <h1 className="mt-2 font-serif text-[28px] font-normal leading-[1.15] sm:text-[34px]">{title} <span className="text-[#4A5263]">· {ctx.venue.acr}</span></h1>
              </div>
              {due ? <DuePill at={due.at} kind={due.kind} generatedAt={generatedAt} /> : null}
            </div>
          </div>
        </Pin>
      }
      rail={
        <Pin name="wz-rail">
          <aside className="w-full lg:w-[220px] lg:flex-none">
            <Link href={base} className="block rounded-[8px] border border-[#DADDE3] bg-white px-3 py-2.5 text-[#121826] no-underline hover:border-[#B7BDC9]">
              <span className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]"><span>{t("Paper {no}", { no })}</span><span>{t(STAGE_TAG[ctx.sub.stage] ?? ctx.sub.stage)}</span></span>
              <span className="mt-1 line-clamp-2 block text-[14px] font-semibold">{ctx.sub.title}</span>
              <span className="block text-[12px] text-[#2F5FD0]">{t("View paper status →")}</span>
            </Link>
            {flow ? (
              <>
                <p className="mb-2 mt-5 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">
                  {flow.steps.some((s) => s.state === "current")
                    ? t("{flow} · step {n} of {total}", { flow: flow.name, n: flow.steps.findIndex((s) => s.state === "current") + 1, total: flow.steps.length })
                    : t("{flow} · all steps done", { flow: flow.name })}
                </p>
                <ol className="m-0 flex list-none flex-row gap-1 overflow-x-auto p-0 lg:flex-col">
                  {flow.steps.map((s, i) => {
                    const cur = s.state === "current", done = s.state === "done";
                    const badge = done ? <span className="flex size-6 flex-none items-center justify-center rounded-full bg-[#18744F] text-[11px] text-white" aria-label={t("Done")}>✓</span>
                      : cur ? <span className="flex size-6 flex-none items-center justify-center rounded-full bg-[#F2A93B] text-[12px] font-semibold text-[#0E1B3D]">{i + 1}</span>
                      : <span className="box-border flex size-6 flex-none items-center justify-center rounded-full border-[1.5px] border-[#B7BDC9] text-[12px] text-[#4A5263]">{i + 1}</span>;
                    const body = <span className="flex items-center gap-3">{badge}<span className={`whitespace-nowrap text-[15px] ${cur ? "font-semibold" : ""}`}>{s.label}</span></span>;
                    const cls = `block flex-none rounded-[8px] px-2.5 py-2 text-[#121826] no-underline ${cur ? "border border-[#DADDE3] bg-white" : ""}`;
                    return <li key={s.label}>{s.href && !cur ? <Link href={s.href} className={`${cls} hover:bg-white`}>{body}</Link> : <span aria-current={cur ? "step" : undefined} className={cls}>{body}</span>}</li>;
                  })}
                </ol>
                {flow.note ? <p className="mt-4 hidden text-[13px] text-[#4A5263] lg:block">{flow.note}</p> : null}
              </>
            ) : null}
          </aside>
        </Pin>
      }
      aside={aside}
    >
      <StepMark n={flow?.mark ?? 30} />
      <div className={wide ? "lg:max-w-none" : ""}>{children}</div>
    </WizardLayout>
  );
}

/** Steps helper: marks steps before `current` done (or as given). */
export function steps(labels: [string, string][], current: number, doneUpTo = current - 1): FlowStep[] {
  return labels.map(([label, href], i) => ({ label, href, state: i === current ? "current" : i <= doneUpTo ? "done" : "todo" }));
}
