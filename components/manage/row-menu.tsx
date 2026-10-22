"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "@/components/site/link";
import { useT } from "@/lib/i18n/client";

export type RowAction = { label: string; href?: string; onClick?: () => void; danger?: boolean };

/**
 * One "⋯" button per table row instead of a line of text actions on every row. The menu is placed with fixed
 * positioning, so a scrolling table never clips it; it closes on Escape, an outside click, or a choice.
 */
export function RowMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  const t = useT();
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!at) return;
    const out = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setAt(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setAt(null); btn.current?.focus(); } };
    const close = () => setAt(null);
    document.addEventListener("mousedown", out);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", close, true);
    box.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc); window.removeEventListener("scroll", close, true); };
  }, [at]);
  if (!actions.length) return null;
  function toggle() {
    if (at) { setAt(null); return; }
    const r = btn.current!.getBoundingClientRect();
    const below = window.innerHeight - r.bottom > 44 * actions.length + 16;
    setAt({ top: below ? r.bottom + 4 : r.top - 4 - (40 * actions.length + 12), right: window.innerWidth - r.right });
  }
  const item = "flex h-10 w-full cursor-pointer items-center whitespace-nowrap rounded-[4px] border-0 bg-transparent px-3 text-start text-[14px] no-underline hover:bg-[#F5F6F3]";
  return (
    <>
      <button ref={btn} type="button" onClick={toggle} aria-haspopup="menu" aria-expanded={!!at} aria-label={t("Actions for {name}", { name: label })}
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-[6px] border border-transparent bg-transparent text-[#4A5263] hover:border-[#DADDE3] hover:bg-white">
        <MoreHorizontal size={16} aria-hidden />
      </button>
      {at ? (
        <div ref={box} role="menu" style={{ position: "fixed", top: at.top, right: at.right }}
          className="z-50 min-w-[180px] rounded-[8px] border border-[#DADDE3] bg-white p-1.5 shadow-[0_12px_32px_rgba(18,24,38,.16)]">
          {actions.map((a) => a.href
            ? <Link key={a.label} role="menuitem" href={a.href} onClick={() => setAt(null)} className={`${item} ${a.danger ? "text-[#B3261E]" : "text-[#121826]"}`}>{a.label}</Link>
            : <button key={a.label} type="button" role="menuitem" onClick={() => { setAt(null); a.onClick?.(); }} className={`${item} ${a.danger ? "text-[#B3261E]" : "text-[#121826]"}`}>{a.label}</button>)}
        </div>
      ) : null}
    </>
  );
}
