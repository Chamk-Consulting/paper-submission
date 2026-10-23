"use client";

import { DeleteDraftButton } from "@/components/submission/delete-draft";
import Link from "@/components/site/link";
import type { ReactNode } from "react";
import { DeadlinePill } from "@/components/submission/live";
import { useT } from "@/lib/i18n/client";
import { Pin } from "@/components/motion/pin";
import { STEPS, type StepKey } from "@/lib/submission/steps";
import type { WizardVenue } from "@/lib/submission/data";

/* Text-bearing frame pieces of canvas SB01–SB08 (client: translated with useT). */

/** The site header is shared (root layout). Wizards keep a slim strip for their save status, if any. */
export function WizardHeader({ right }: { initials: string; right?: ReactNode }) {
  if (!right) return null;
  return (
    <div className="border-b border-[#DADDE3] bg-white">
      <div className="mx-auto box-border flex min-h-10 w-full max-w-[1280px] items-center justify-end gap-4 px-5 text-[14px] sm:px-8">{right}</div>
    </div>
  );
}

export function TitleBand({ crumb, title, venue, generatedAt, closedOn }: { crumb: string; title: string; venue: WizardVenue; generatedAt: string; closedOn?: string }) {
  const t = useT();
  return (
    <Pin name="wz-band">
    <div className="border-b border-[#DADDE3] bg-white">
      <div className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-3 px-5 pb-5 pt-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="m-0 text-[14px] text-[#4A5263]"><Link href="/workspace/submissions" className="text-[#121826] underline">{t("My workspace")}</Link> / {crumb}</p>
          <h1 className="mt-2 font-serif text-[28px] font-normal leading-[1.15] sm:text-[34px]">{title} <span className="text-[#4A5263]">· {venue.acr}</span></h1>
        </div>
        <DeadlinePill deadline={venue.deadline} generatedAt={generatedAt} closedOn={closedOn} />
      </div>
    </div>
    </Pin>
  );
}

export type RailState = { done: Record<StepKey, boolean>; current: StepKey | null; reachable: number; base: string; loading?: boolean };

export function StepRail({ rail, draft, footer = true }: { rail: RailState; draft?: { title: string; venue: string; index: number; total: number; switchHref?: string; deletable?: boolean } | "loading"; footer?: boolean }) {
  const t = useT();
  const cur = STEPS.find((s) => s.key === rail.current);
  return (
    <Pin name="wz-rail">
    <aside className="w-full lg:w-[220px] lg:flex-none">
      {draft === "loading" ? (
        <div aria-hidden className="rounded-[8px] border border-[#DADDE3] bg-white px-3 py-2.5">
          <span className="flex h-[17px] items-center"><span className="sk block h-2.5 w-[90px]" /></span>
          <span className="mt-1 flex h-[21px] items-center"><span className="sk block h-3 w-[85%]" /></span>
          <span className="flex h-[18px] items-center"><span className="sk block h-2.5 w-[60px]" /></span>
        </div>
      ) : draft ? (
        <div className="rounded-[8px] border border-[#DADDE3] bg-white px-3 py-2.5">
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">
            <span>{t("Draft {n} of {total}", { n: draft.index, total: draft.total })}</span>
            {draft.switchHref && draft.total > 1 ? <Link href={draft.switchHref} className="font-sans text-[12px] font-semibold normal-case tracking-normal text-[#2F5FD0] no-underline">{t("Switch")} ▾</Link> : null}
          </div>
          <div className="mt-1 line-clamp-2 text-[14px] font-semibold">{draft.title}</div>
          <div className="text-[12px] text-[#4A5263]">{draft.venue}</div>
          {draft.deletable && rail.base.startsWith("/submissions/") ? <DeleteDraftButton id={rail.base.split("/")[2]} /> : null}
        </div>
      ) : null}
      <p className="mb-2 mt-5 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{cur ? t("Step {n} of 7", { n: cur.n }) : t("Submitted · all steps done")}</p>
      <ol className="m-0 flex list-none flex-row gap-1 overflow-x-auto p-0 lg:flex-col">
        {STEPS.map((s) => {
          const isCur = s.key === rail.current, done = rail.done[s.key] && !isCur, can = s.n <= rail.reachable && rail.base;
          const badge = done ? (
            <span className="flex size-6 flex-none items-center justify-center rounded-full bg-[#18744F] text-[11px] text-white" aria-label={t("Done")}>✓</span>
          ) : isCur ? (
            <span className="flex size-6 flex-none items-center justify-center rounded-full bg-[#F2A93B] text-[12px] font-semibold text-[#0E1B3D]">{s.n}</span>
          ) : (
            <span className="box-border flex size-6 flex-none items-center justify-center rounded-full border-[1.5px] border-[#B7BDC9] text-[12px] text-[#4A5263]">{s.n}</span>
          );
          const body = (
            <span className="flex items-center gap-3">
              {badge}
              <span className="whitespace-nowrap">
                <span className={`block text-[15px] ${isCur ? "font-semibold" : ""}`}>{t(s.label)}</span>
                {done ? <span className="block text-[12px] text-[#14603F]">{t("Done")}</span> : isCur ? <span className="block text-[12px] text-[#7A4508]">{t("In progress")}</span> : null}
              </span>
            </span>
          );
          const cls = `flex-none rounded-[8px] px-2.5 py-2 no-underline ${isCur ? "border border-[#DADDE3] bg-white text-[#121826]" : "text-[#121826]"}`;
          return <li key={s.key}>{can && !isCur ? <Link href={`${rail.base}/${s.key}`} className={`${cls} block hover:bg-white`}>{body}</Link> : <span aria-current={isCur ? "step" : undefined} className={`${cls} block ${!can && !isCur && !rail.loading ? "opacity-70" : ""}`}>{body}</span>}</li>;
        })}
      </ol>
      {footer ? <p className="mt-4 hidden text-[13px] text-[#4A5263] lg:block">{t("Your work is saved each time you continue. You can leave and come back until the deadline.")}</p> : null}
    </aside>
    </Pin>
  );
}

