import Link from "next/link";
import type { ReactNode } from "react";
import { Footer, TopBar } from "@/components/auth/chrome";

/* Shared shell of canvas PR02–PR09: paper form column + navy aside. */

export { Logo } from "@/components/auth/logo";

export function SplitLayout({ banner, children, aside, width = 420 }: { banner?: ReactNode; children: ReactNode; aside: ReactNode; width?: 420 | 440 }) {
  return (
    <div className="flex min-h-dvh flex-wrap bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <main className="box-border flex min-w-0 flex-[5_1_440px] flex-col px-5 py-7 sm:px-10">
        <TopBar />
        {banner}
        <div className="flex flex-auto items-center justify-center py-8">
          <div className="w-full" style={{ maxWidth: width }}>{children}</div>
        </div>
        <Footer />
      </main>
      {aside}
    </div>
  );
}

export function NavyAside({ label, kicker, title, children, titleSize = 44 }: { label: string; kicker: string; title: ReactNode; children?: ReactNode; titleSize?: 40 | 44 }) {
  return (
    <aside aria-label={label} className="box-border flex min-w-0 flex-[7_1_520px] flex-col justify-center bg-[#0E1B3D] px-6 py-14 text-[#F5F6F3] sm:px-16">
      <p className="m-0 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#F2A93B]">{kicker}</p>
      <h2 className="mt-3.5 max-w-[18ch] font-serif font-[350] leading-[1.08] tracking-[-0.015em]" style={{ fontSize: titleSize }}>{title}</h2>
      {children}
    </aside>
  );
}

export type StepState = "done" | "current" | "next";
export function SetupSteps({ steps, doneLabel = "Done" }: { steps: { title: string; text: ReactNode; state: StepState }[]; doneLabel?: string }) {
  return (
    <ol className="mt-9 flex max-w-[480px] list-none flex-col p-0">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-4">
          <div className="flex flex-col items-center">
            {s.state === "done" ? (
              <span className="flex size-[26px] items-center justify-center rounded-full bg-[#18744F] text-[12px] text-white" aria-label={doneLabel}>✓</span>
            ) : s.state === "current" ? (
              <span className="flex size-[26px] items-center justify-center rounded-full bg-[#F2A93B] font-mono text-[12px] font-semibold text-[#0E1B3D]" aria-current="step">{i + 1}</span>
            ) : (
              <span className="box-border flex size-[26px] items-center justify-center rounded-full border-[1.5px] border-[#3A4A78] font-mono text-[12px] font-semibold text-[#B9C3DA]">{i + 1}</span>
            )}
            {i < steps.length - 1 ? <span className="min-h-6 w-0.5 flex-auto bg-[#24335C]" /> : null}
          </div>
          <div className={i < steps.length - 1 ? "pb-[22px]" : ""}>
            <div className={`font-semibold ${s.state === "current" ? "text-[#F2A93B]" : ""}`}>{s.title}</div>
            <div className="text-[14px] text-[#B9C3DA]">{s.text}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ShieldNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-9 flex max-w-[520px] items-start gap-3 rounded-[8px] border border-[#24335C] px-[18px] py-4 text-[14px] text-[#D6DCEA]">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="#F2A93B" strokeWidth="1.5" className="mt-0.5 flex-none"><path d="M9 2l6 2.5v4.2c0 3.6-2.6 6.2-6 7.3-3.4-1.1-6-3.7-6-7.3V4.5z" /></svg>
      <span>{children}</span>
    </div>
  );
}

export function VenueBannerBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-7 flex items-start gap-3 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3.5 py-3 text-[14px] text-[#3B2A07]">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden fill="none" stroke="#8A5A0B" strokeWidth="1.5" className="mt-px flex-none"><circle cx="9" cy="9" r="7" /><path d="M9 5v4l2.5 1.5" /></svg>
      <span>{children}</span>
    </div>
  );
}

export const ui = {
  h1: "font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]",
  kicker: "font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#4A5263]",
  label: "text-[14px] font-medium",
  input:
    "box-border h-11 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[16px] text-[#121826] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5FD0]",
  primary:
    "flex h-[46px] w-full items-center justify-center rounded-[4px] border-0 bg-[#F2A93B] text-[15px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26] disabled:opacity-60",
  secondary: "flex items-center justify-center gap-2 rounded-[4px] border border-[#B7BDC9] bg-white font-medium text-[#121826] hover:bg-[#F7F8F6]",
  link: "text-[#2F5FD0] underline hover:text-[#1F47A8]",
  muted: "text-[#4A5263]",
  error: "text-[13px] text-[#B3261E]",
};

export const OrcidIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden className="flex-none"><circle cx="9" cy="9" r="8.5" fill="#A6CE39" /><text x="9" y="12.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="700" fill="#FFFFFF">iD</text></svg>
);
