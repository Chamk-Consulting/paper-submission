"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * Form label with a red "*" for required fields and an optional (i) button that opens a short explanation.
 * The explanation opens on click/tap (and keyboard), closes on Escape or a click elsewhere.
 */
export function FieldLabel({ htmlFor, children, required = false, info }: { htmlFor?: string; children: ReactNode; required?: boolean; info?: ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  return (
    <span className="flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="text-[14px] font-medium">
        {children}
        {required ? <><span aria-hidden className="ml-0.5 text-[#B3261E]">*</span><span className="sr-only"> ({t("required")})</span></> : null}
      </label>
      {info ? (
        <span ref={box} className="relative inline-flex">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={tipId} aria-label={t("More about this field")}
            className="flex size-[18px] items-center justify-center rounded-full border border-[#B7BDC9] bg-white p-0 text-[11px] font-semibold leading-none text-[#4A5263] hover:border-[#2F5FD0] hover:text-[#2F5FD0]">
            i
          </button>
          {open ? (
            <span id={tipId} role="tooltip" className="absolute left-0 top-[24px] z-20 w-[260px] rounded-[6px] border border-[#DADDE3] bg-white px-3 py-2.5 text-[13px] font-normal leading-[1.45] text-[#121826] shadow-[0_8px_24px_rgba(18,24,38,.14)]">
              {info}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
