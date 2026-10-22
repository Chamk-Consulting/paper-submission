"use client";

import Link from "@/components/site/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Tag } from "@/components/review/parts";
import type { TAG } from "@/lib/review/shared";

export type Row = {
  id: string; tab: "todo" | "done" | "declined"; tone: keyof typeof TAG; tag: string; no: string; title: string;
  detail: string; when: string; soon: boolean; cta: string; href: string;
};

const TABS: ["todo" | "done" | "declined", string][] = [["todo", "To do"], ["done", "Submitted"], ["declined", "Declined"]];

/** RV01 "My reviews" with segmented tabs. */
export function ReviewsList({ rows }: { rows: Row[] }) {
  const t = useT();
  const [tab, setTab] = useState<Row["tab"]>("todo");
  const list = rows.filter((r) => r.tab === tab);
  return (
    <section className="rounded-[8px] border border-[#DADDE3] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF0EC] px-5 py-4">
        <h2 className="m-0 font-serif text-[22px] font-normal">{t("My reviews")}</h2>
        <div role="tablist" aria-label={t("My reviews")} className="inline-flex rounded-[6px] border border-[#DADDE3] p-0.5">
          {TABS.map(([k, l]) => {
            const on = tab === k;
            return (
              <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setTab(k)}
                className={`h-8 rounded-[4px] border-0 px-3 text-[13px] font-medium ${on ? "bg-[#0E1B3D] text-[#F5F6F3]" : "bg-transparent text-[#4A5263] hover:text-[#121826]"}`}>
                {t(l)} · {rows.filter((r) => r.tab === k).length}
              </button>
            );
          })}
        </div>
      </div>
      {list.length === 0 ? (
        <p className="m-0 px-5 py-8 text-center text-[14px] text-[#4A5263]">{t("Nothing in this list.")}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {list.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#EEF0EC] px-5 py-3.5 last:border-b-0">
              <div className="w-[104px] flex-none"><Tag tone={r.tone}>{r.tag}</Tag></div>
              <div className="min-w-[200px] flex-auto">
                <div className="text-[15px] font-medium"><span className="font-mono text-[13px] text-[#4A5263]">{r.no}</span> · {r.title}</div>
                <div className="text-[13px] text-[#4A5263]">{r.detail}</div>
              </div>
              <div className={`w-[120px] flex-none text-[13px] ${r.soon ? "font-medium text-[#A8600F]" : "text-[#4A5263]"}`}>{r.when}</div>
              <Link href={r.href} className={`inline-flex h-9 w-[96px] flex-none items-center justify-center rounded-[4px] text-[14px] font-semibold no-underline ${i === 0 && tab === "todo" ? "bg-[#F2A93B] text-[#0E1B3D] hover:bg-[#E89B26]" : "border border-[#B7BDC9] bg-white text-[#121826] hover:bg-[#F7F8F6]"}`}>
                {r.cta}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
