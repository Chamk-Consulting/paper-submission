import Link from "@/components/site/link";
import type { ReactNode } from "react";
import { TAG } from "@/lib/review/shared";

/* Small presentational pieces shared by the reviewer screens (server or client). */

export function Crumbs({ items }: { items: [string, string | null][] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-[#4A5263]">
      {items.map(([label, href], i) => (
        <span key={i}>
          {i ? <span className="mx-1.5 text-[#6B7385]">/</span> : null}
          {href ? <Link href={href} className="text-[#2F5FD0] no-underline hover:underline">{label}</Link> : <span>{label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Head({ kicker, title, sub, right }: { kicker?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker ? <p className="m-0 font-mono text-[12px] text-[#4A5263]">{kicker}</p> : null}
        <h1 className="mt-1.5 mb-0 font-serif text-[36px] font-normal leading-[1.12] tracking-[-0.01em] sm:text-[40px]">{title}</h1>
        {sub ? <p className="mb-0 mt-1.5 text-[#4A5263]">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Tag({ tone, children }: { tone: keyof typeof TAG; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-[3px] px-1.5 py-px font-mono text-[11px] font-medium uppercase tracking-[0.04em] ${TAG[tone]}`}>{children}</span>;
}

/** Two-column body: main + 300px aside (stacks on narrow screens). */
export function Cols({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  return (
    <div className="mt-[22px] flex flex-col items-start gap-6 xl:flex-row">
      <div className="flex w-full min-w-0 flex-auto flex-col gap-4">{main}</div>
      <aside className="flex w-full flex-col gap-3.5 xl:w-[300px] xl:flex-none">{aside}</aside>
    </div>
  );
}

export const box = "rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5";
export const kick = "m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]";
export const asideLink = "block py-1 text-[14px] text-[#2F5FD0] no-underline hover:underline";

export function Banner({ tone, children }: { tone: "warn" | "bad" | "ok" | "info"; children: ReactNode }) {
  const cls = {
    warn: "border-[#F1D29A] bg-[#FFF6E6] text-[#3B2A07]",
    bad: "border-[#F3C3BE] bg-[#FDECEA] text-[#8C1D18]",
    ok: "border-[#B9E0CB] bg-[#E1F3EA] text-[#14603F]",
    info: "border-[#C9D6F5] bg-[#F3F6FD] text-[#1F2F5C]",
  }[tone];
  return <div role={tone === "bad" ? "alert" : "status"} className={`rounded-[6px] border px-3.5 py-2.5 text-[14px] ${cls}`}>{children}</div>;
}

/** Shown when the assignment id is unknown or not the caller's. */
export function NotYours({ t }: { t: (k: string) => string }) {
  return (
    <div className="mt-6 max-w-[620px] rounded-[8px] border border-[#DADDE3] bg-white p-6">
      <h1 className="m-0 font-serif text-[28px] font-normal">{t("Review not found")}</h1>
      <p className="mb-0 mt-2 text-[#4A5263]">{t("This review doesn't exist or isn't assigned to you.")}</p>
      <Link href="/reviews" className="mt-4 inline-block text-[#2F5FD0]">{t("Back to the review list")}</Link>
    </div>
  );
}
