import Link from "@/components/site/link";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

/* Canvas ER01 system pages: public header, one centred card, navy footer. */

export type SystemTone = "neutral" | "warn" | "bad" | "info";
const TONE: Record<SystemTone, [string, string]> = { neutral: ["#EEF0EC", "#4A5263"], warn: ["#FBEFDD", "#7A4508"], bad: ["#FDECEA", "#B3261E"], info: ["#E6EDFC", "#1F47A8"] };
type Btn = { href: string; label: string };

export function SystemCard({ icon, tone, code, title, body, primary, secondary, note }: {
  icon: string; tone: SystemTone; code: string; title: string; body?: ReactNode; primary: Btn; secondary?: Btn; note?: ReactNode;
}) {
  const [bg, ink] = TONE[tone];
  return (
    <section className="mx-auto mt-10 max-w-[640px] rounded-[12px] border border-[#DADDE3] bg-white px-6 py-11 text-center sm:px-10">
      <div aria-hidden className="mx-auto flex size-[72px] items-center justify-center rounded-full font-serif text-[32px]" style={{ background: bg, color: ink }}>{icon}</div>
      <p className="mb-0 mt-[18px] font-mono text-[12px] tracking-[0.06em] text-[#4A5263]">{code}</p>
      <h1 className="mt-1.5 font-serif text-[30px] font-normal leading-[1.15] sm:text-[36px]">{title}</h1>
      {body ? <p className="mx-auto mt-2.5 max-w-[46ch] leading-[1.6] text-[#4A5263]">{body}</p> : null}
      <div className="mt-[22px] flex flex-wrap justify-center gap-2.5">
        <Link href={primary.href} className="inline-flex h-[46px] items-center justify-center rounded-[4px] bg-[#F2A93B] px-[18px] text-[15px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">{primary.label}</Link>
        {secondary ? <Link href={secondary.href} className="inline-flex h-[46px] items-center justify-center rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[14px] font-medium text-[#121826] no-underline hover:bg-[#F7F8F6]">{secondary.label}</Link> : null}
      </div>
      {note ? <p className="mb-0 mt-[18px] text-[13px] text-[#4A5263]">{note}</p> : null}
    </section>
  );
}

export function SystemFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <SiteHeader />
      <main className="mx-auto box-border w-full max-w-[1280px] flex-auto px-5 pb-14 pt-7 sm:px-8">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function SystemPage(props: Parameters<typeof SystemCard>[0]) {
  return <SystemFrame><SystemCard {...props} /></SystemFrame>;
}
