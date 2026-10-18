"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";

/* Canvas PO02 — size toggle + three plans with a live estimate. Prices are placeholders. */

const SIZES = [["small", "Small", 80], ["medium", "Medium", 450], ["large", "Large", 1200]] as const;
const ACCEPT_RATE = 0.37;

type Plan = { id: string; name: string; sub: string; price: string; unit: string; note: string; features: string[]; cta: string; href: string; featured?: boolean; estimate: (papers: number) => number | null };
const PLANS: Plan[] = [
  { id: "workshop", name: "Workshop", sub: "Single track, one review round", price: "[$0]", unit: "up to 50 papers", note: "Free for small events",
    features: ["Submissions & double-blind review", "Email invitations without sign-in", "Program & session pages", "Plenary support by email"], cta: "Start free", href: "/manage/new",
    estimate: (n) => (n <= 50 ? 0 : null) },
  { id: "conference", name: "Conference", sub: "Full IEEE-style workflow", price: "[$4]", unit: "per accepted paper", note: "plus [$500] per event", featured: true,
    features: ["Everything in Workshop", "Associate editors & bidding", "Copyright (IEEE eCF) & Xplore export", "Program builder with clash checks", "Audit log & conflict firewall"], cta: "Start a trial event", href: "/manage/new",
    estimate: (n) => 500 + 4 * Math.round(n * ACCEPT_RATE) },
  { id: "society", name: "Society", sub: "Many events, one contract", price: "Custom", unit: "yearly", note: "For societies running 5+ events",
    features: ["Everything in Conference", "Shared reviewer pool & history", "SSO for your members", "Data residency options", "Named success manager"], cta: "Talk to us", href: "/contact?tab=sales",
    estimate: () => null },
];

export function PricingPlans() {
  const t = useT();
  const [size, setSize] = useState<(typeof SIZES)[number][0]>("medium");
  const papers = SIZES.find((s) => s[0] === size)![2];
  const accepted = Math.round(papers * ACCEPT_RATE);
  const fmt = (n: number) => new Intl.NumberFormat(t.intl).format(n);

  return (
    <>
      <div role="radiogroup" aria-label={t("Event size")} className="mt-7 inline-flex flex-wrap rounded-[6px] border border-[#B7BDC9] bg-white p-1">
        {SIZES.map(([id, l, n]) => (
          <button key={id} type="button" role="radio" aria-checked={size === id} onClick={() => setSize(id)}
            className={`h-10 cursor-pointer rounded-[4px] border-0 px-4 text-[14px] font-medium ${size === id ? "bg-[#0E1B3D] text-white" : "bg-transparent text-[#121826] hover:bg-[#F5F6F3]"}`}>
            {t(l)} · {t("{n} papers", { n: fmt(n) })}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-[#4A5263]">{t("Estimates assume about {pct}% of submissions are accepted ({n} papers).", { pct: Math.round(ACCEPT_RATE * 100), n: fmt(accepted) })}</p>

      <div className="mt-6 grid items-stretch gap-4 lg:grid-cols-3">
        {PLANS.map((p) => {
          const est = p.estimate(papers);
          return (
            <article key={p.id} className={`relative flex flex-col rounded-[10px] bg-white p-6 ${p.featured ? "border-2 border-[#F2A93B]" : "border border-[#DADDE3]"}`}>
              {p.featured ? <span className="absolute -top-3 left-6 rounded-[3px] bg-[#F2A93B] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#0E1B3D]">{t("Most chosen")}</span> : null}
              <h2 className="m-0 font-serif text-[26px] font-normal">{t(p.name)}</h2>
              <p className="mt-1 text-[14px] text-[#4A5263]">{t(p.sub)}</p>
              <p className="mb-0 mt-4"><span className="font-serif text-[40px] leading-none">{t(p.price)}</span> <span className="text-[14px] text-[#4A5263]">{t(p.unit)}</span></p>
              <p className="mt-1 text-[13px] text-[#4A5263]">{t(p.note)}</p>
              <p className="mt-3 rounded-[6px] bg-[#F7F8F6] px-3 py-2 text-[14px]" aria-live="polite">
                {est === null
                  ? (p.id === "workshop" ? t("Too large for this plan at {n} papers", { n: fmt(papers) }) : t("Priced with you"))
                  : t("About {price} for {n} accepted papers", { price: `[$${fmt(est)}]`, n: fmt(accepted) })}
              </p>
              <ul className="m-0 mt-4 flex flex-auto list-none flex-col gap-2 p-0 text-[14px]">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="#18744F" strokeWidth="2" className="mt-0.5 flex-none"><path d="M3.5 8.5l3 3 6-7" /></svg>{t(f)}</li>
                ))}
              </ul>
              <Link href={p.href} className={`mt-6 inline-flex h-11 items-center justify-center rounded-[4px] text-[15px] font-semibold no-underline ${p.featured ? "bg-[#F2A93B] text-[#0E1B3D] hover:bg-[#E89B26]" : "border border-[#B7BDC9] bg-white text-[#121826] hover:bg-[#F7F8F6]"}`}>{t(p.cta)}</Link>
            </article>
          );
        })}
      </div>
    </>
  );
}
