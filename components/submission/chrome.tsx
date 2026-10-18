"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { DeadlinePill } from "@/components/submission/live";
import { LanguageSelect } from "@/components/i18n/language-select";
import { useT } from "@/lib/i18n/client";
import { Pin } from "@/components/motion/pin";
import { STEPS, type StepKey } from "@/lib/submission/steps";
import type { WizardVenue } from "@/lib/submission/data";

/* Text-bearing frame pieces of canvas SB01–SB08 (client: translated with useT). */

export function WizardHeader({ initials, right }: { initials: string; right?: ReactNode }) {
  const t = useT();
  return (
    <Pin name="wz-header">
    <header className="border-b border-[#DADDE3] bg-white">
      <div className="flex min-h-[60px] items-center justify-between gap-4 px-5 sm:px-8">
        <div className="flex items-center gap-7">
          <Link href="/workspace" className="flex items-center gap-2.5 text-[#121826] no-underline">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden fill="none" stroke="#121826" strokeWidth="1.5"><circle cx="11" cy="11" r="9.25" /><path d="M4 11h14M11 2v18" /><circle cx="11" cy="11" r="2.5" fill="#F2A93B" stroke="none" /></svg>
            <span className="font-serif text-[22px]">Plenary</span>
          </Link>
          <nav aria-label={t("Primary")} className="hidden gap-5 text-[14px] font-medium sm:flex">
            <Link href="/workspace" className="border-b-2 border-[#0E1B3D] py-[18px] text-[#121826] no-underline">{t("My workspace")}</Link>
            <Link href="/venues" className="border-b-2 border-transparent py-[18px] text-[#4A5263] no-underline hover:text-[#121826]">{t("Venues")}</Link>
            <Link href="/account-help" className="border-b-2 border-transparent py-[18px] text-[#4A5263] no-underline hover:text-[#121826]">{t("Help")}</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSelect id="wz-lang" className="hidden sm:block" />
          {right}
          {initials ? (
            <span aria-label={t("Your account")} className="flex size-8 items-center justify-center rounded-full bg-[#E6EDFC] text-[13px] font-semibold text-[#1F47A8]">{initials}</span>
          ) : (
            <span aria-hidden className="sk block size-8 rounded-full!" />
          )}
        </div>
      </div>
    </header>
    </Pin>
  );
}

export function TitleBand({ crumb, title, venue, generatedAt }: { crumb: string; title: string; venue: WizardVenue; generatedAt: string }) {
  const t = useT();
  return (
    <Pin name="wz-band">
    <div className="border-b border-[#DADDE3] bg-white">
      <div className="flex flex-col gap-3 px-5 pb-5 pt-6 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="m-0 text-[14px] text-[#4A5263]"><Link href="/workspace/submissions" className="text-[#121826] underline">{t("My workspace")}</Link> / {crumb}</p>
          <h1 className="mt-2 font-serif text-[28px] font-normal leading-[1.15] sm:text-[34px]">{title} <span className="text-[#4A5263]">· {venue.acr}</span></h1>
        </div>
        <DeadlinePill deadline={venue.deadline} generatedAt={generatedAt} />
      </div>
    </div>
    </Pin>
  );
}

export type RailState = { done: Record<StepKey, boolean>; current: StepKey | null; reachable: number; base: string; loading?: boolean };

export function StepRail({ rail, draft, footer = true }: { rail: RailState; draft?: { title: string; venue: string; index: number; total: number; switchHref?: string } | "loading"; footer?: boolean }) {
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

