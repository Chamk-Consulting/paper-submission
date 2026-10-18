import type { ReactNode } from "react";
import { SavedAgo } from "@/components/submission/live";
export { WizardHeader, TitleBand, StepRail, type RailState } from "@/components/submission/chrome";

/* Shared frame of canvas SB01–SB08. */

export function WizardLayout({ header, band, rail, children, aside }: { header: ReactNode; band: ReactNode; rail: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      {header}
      {band}
      <div className="flex w-full max-w-[1340px] flex-col gap-6 px-5 pb-16 pt-7 sm:px-8 lg:flex-row lg:items-start lg:gap-8">
        {rail}
        <main className="w-full min-w-0 lg:max-w-[680px] lg:flex-auto">{children}</main>
        {aside ? <aside className="flex w-full flex-col gap-4 lg:w-[300px] lg:flex-none">{aside}</aside> : null}
      </div>
    </div>
  );
}

export const card = "rounded-[8px] border border-[#DADDE3] bg-white p-[22px]";
export const h2 = "m-0 font-serif text-[22px] font-normal";
export const kicker = "m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]";
export const asideCard = "rounded-[8px] border border-[#DADDE3] bg-white px-[18px] py-4";
export const noteBlue = "rounded-[8px] bg-[#E6EDFC] px-4 py-3.5 text-[14px] text-[#1F2E5C]";
export const primaryBtn = "inline-flex h-12 items-center justify-center rounded-[4px] border-0 bg-[#F2A93B] px-5 text-[16px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26] disabled:opacity-60";
export const ghostBtn = "inline-flex h-12 items-center justify-center rounded-[4px] border border-[#B7BDC9] bg-white px-5 text-[15px] font-medium text-[#121826] no-underline hover:bg-[#F7F8F6]";

export { SavedAgo };
