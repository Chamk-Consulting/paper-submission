"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

/* PP01 "Cite this paper": BibTeX / IEEE / APA, copy to clipboard. */
export function CiteBox({ formats }: { formats: { key: string; label: string; text: string }[] }) {
  const t = useT();
  const [cur, setCur] = useState(formats[0]?.key ?? "");
  const [copied, setCopied] = useState(false);
  const f = formats.find((x) => x.key === cur) ?? formats[0];
  return (
    <section className="rounded-[8px] border border-[#DADDE3] bg-white px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-[17px] font-semibold">{t("Cite this paper")}</h2>
        <div role="tablist" aria-label={t("Citation format")} className="flex gap-1.5">
          {formats.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={x.key === f.key} onClick={() => { setCur(x.key); setCopied(false); }}
              className={`h-[30px] rounded-[4px] border border-[#DADDE3] px-3 text-[13px] font-semibold ${x.key === f.key ? "bg-[#0E1B3D] text-[#F5F6F3]" : "bg-white text-[#4A5263]"}`}>{x.label}</button>
          ))}
        </div>
      </div>
      <pre className="mb-0 mt-3 whitespace-pre-wrap break-words rounded-[6px] border border-[#EEF0EC] bg-[#F7F8F6] p-3.5 font-mono text-[13px] leading-[1.6]">{f.text}</pre>
      <div className="mt-2.5 flex items-center gap-3">
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(f.text); setCopied(true); } catch { setCopied(false); } }}
          className="inline-flex h-8 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[13px] font-semibold text-[#0E1B3D]">{t("Copy")}</button>
        <span role="status" className="text-[13px] text-[#14603F]">{copied ? t("Copied.") : ""}</span>
      </div>
    </section>
  );
}
