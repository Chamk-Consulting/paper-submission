"use client";

import Link from "next/link";
import { useState } from "react";
import type { Row } from "@/components/venues/directory";
import { useT } from "@/lib/i18n/client";

/** Canvas PV01 "Past venues" tab. */
export function PastView({ rows }: { rows: Row[] }) {
  const t = useT();
  const years = [...new Set(rows.map((r) => r.startsOn?.slice(0, 4)).filter(Boolean) as string[])].sort().reverse();
  const [year, setYear] = useState("all");
  const list = rows
    .filter((r) => year === "all" || r.startsOn?.startsWith(year))
    .sort((a, b) => (b.startsOn ?? "").localeCompare(a.startsOn ?? ""));
  const grid = "grid grid-cols-[48px_minmax(0,1fr)_70px] gap-3 md:grid-cols-[60px_minmax(0,1fr)_90px_90px_160px]";

  return (
    <>
      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("Year")}</span>
        {["all", ...years].map((y) => {
          const on = year === y;
          return (
            <button key={y} type="button" aria-pressed={on} onClick={() => setYear(y)} className="h-7 rounded-full px-3 text-[12px] font-semibold"
              style={{ background: on ? "#0E1B3D" : "#FFFFFF", color: on ? "#F5F6F3" : "#4A5263", border: on ? "1px solid #0E1B3D" : "1px solid #DADDE3" }}>{y === "all" ? t("All") : y}</button>
          );
        })}
      </div>
      <div className="mt-3 overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
        <div className={`${grid} border-b border-[#DADDE3] px-[18px] py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]`}>
          <span>{t("Year")}</span><span>{t("Edition")}</span><span className="text-right">{t("Papers")}</span><span className="hidden text-right md:block">{t("Accepted")}</span><span className="hidden md:block">{t("Open")}</span>
        </div>
        {list.map((p) => (
          <div key={p.id} className={`${grid} items-center border-b border-[#EEF0EC] px-[18px] py-3.5`}>
            <span className="font-mono text-[13px] text-[#4A5263]">{p.startsOn?.slice(0, 4) ?? "—"}</span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <Link href={`/venues/${p.slug}/archive`} className="font-semibold text-[#121826] no-underline hover:underline">{p.acr}</Link>
                <span className="text-[13px] text-[#4A5263]">{[p.city, p.country].filter(Boolean).join(", ") || p.location}</span>
                {p.importedFrom ? <span className="rounded-[2px] bg-[#FBEFDD] px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[#7A4508]">{t("Imported from {source}", { source: p.importedFrom })}</span> : null}
              </span>
              {p.bestPaper ? <span className="mt-0.5 block text-[13px] text-[#4A5263]">{t("Best paper:")} <em>{p.bestPaper}</em></span> : null}
            </span>
            <span className="text-right font-mono text-[13px]">{p.papersCount != null ? p.papersCount.toLocaleString(t.intl) : "—"}</span>
            <span className="hidden text-right md:block">
              <span className="font-mono text-[13px]">{p.acceptanceRate != null ? `${Math.round(p.acceptanceRate)}%` : "—"}</span>
              {p.acceptanceRate != null ? <span aria-hidden className="ml-auto mt-1 block h-1 w-[60px] overflow-hidden rounded-sm bg-[#EEF0EC]"><span className="block h-1 bg-[#0E1B3D]" style={{ width: `${p.acceptanceRate}%` }} /></span> : null}
            </span>
            <span className="hidden flex-wrap gap-x-3 gap-y-1 text-[13px] md:flex">
              <Link href={`/venues/${p.slug}/archive#program`} className="text-[#2F5FD0]">{t("Program")}</Link>
              <Link href={`/venues/${p.slug}/archive#proceedings`} className="text-[#2F5FD0]">{t("Proceedings")}</Link>
              <Link href={`/venues/${p.slug}/archive#awards`} className="text-[#2F5FD0]">{t("Awards")}</Link>
              <Link href={`/venues/${p.slug}/archive#stats`} className="text-[#2F5FD0]">{t("Stats")}</Link>
            </span>
          </div>
        ))}
        {list.length === 0 ? <p className="m-0 px-[18px] py-6 text-[#4A5263]">{t("No past editions match.")}</p> : null}
        <p className="m-0 px-[18px] py-2.5 text-[12px] text-[#4A5263]">{t("Older editions appear here when a society imports its PaperCept export. Paper counts and acceptance rates come from the organizers.")}</p>
      </div>
    </>
  );
}
