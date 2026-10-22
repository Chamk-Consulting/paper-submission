import Link from "@/components/site/link";
import type { ReactNode } from "react";
import { ui } from "@/components/manage/ui";

/* Small presentational pieces shared by ops1 screens (server- and client-safe: no hooks). */

export type Kpi = { l: string; v: string; s?: string; c?: string };

export function KpiRow({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((k) => (
        <div key={k.l} className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5">
          <p className="m-0 text-[13px] text-[#4A5263]">{k.l}</p>
          <p className="m-0 mt-0.5 font-serif text-[28px] leading-[1.15]" style={{ color: k.c ?? "#121826" }}>{k.v}</p>
          {k.s ? <p className="m-0 text-[12px] text-[#4A5263]">{k.s}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function Tag({ bg, ink, children }: { bg: string; ink: string; children: ReactNode }) {
  return <span className={ui.tag} style={{ background: bg, color: ink }}>{children}</span>;
}

export function Rules({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <aside className={ui.card}>
      <p className={ui.kicker}>{title}</p>
      <dl className="m-0 mt-3 flex flex-col gap-2.5">
        {items.map(([k, d]) => (
          <div key={k} className="flex gap-2.5 text-[13px]">
            <dt className="w-8 flex-none font-mono text-[11px] font-semibold text-[#1F47A8]">{k}</dt>
            <dd className="m-0 text-[#4A5263]">{d}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

export function SideStat({ kicker, value, sub }: { kicker: string; value: string; sub?: string }) {
  return (
    <div className={ui.card}>
      <p className={ui.kicker}>{kicker}</p>
      <p className="m-0 mt-1.5 font-serif text-[34px] leading-[1.1]">{value}</p>
      {sub ? <p className="m-0 mt-1 text-[13px] text-[#4A5263]">{sub}</p> : null}
    </div>
  );
}

/** "1 paper hidden — you are an author" (B1, B3). */
export function HiddenNotice({ n, text, why }: { n: number; text: string; why: string }) {
  if (!n) return null;
  return (
    <p className="m-0 flex flex-wrap items-center gap-2 rounded-[6px] border border-[#DADDE3] bg-[#F7F8F6] px-3.5 py-2.5 text-[13px] text-[#4A5263]">
      <span aria-hidden>🔒</span>{text} <Link href="/manage/roles">{why}</Link>
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 px-3.5 py-8 text-center text-[14px] text-[#4A5263]">{children}</p>;
}
