"use client";

import { useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * Code boxes for a form (one box per digit), like the sign-up code screen: type, paste the whole code or let the
 * phone autofill it. The digits go to the form as one hidden field (`name`). When every box is filled,
 * `onComplete` runs (the caller submits the form).
 */
export function CodeBoxes({ name = "code", length = 6, invalid = false, disabled = false, autoFocus = true, onComplete, labelledBy }: {
  name?: string; length?: number; invalid?: boolean; disabled?: boolean; autoFocus?: boolean; onComplete?: (code: string) => void; labelledBy?: string;
}) {
  const t = useT();
  const [digits, setDigits] = useState<string[]>(() => Array<string>(length).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => setTimeout(() => { const el = refs.current[i]; el?.focus(); el?.select(); }, 0);
  const firstEmpty = digits.indexOf("");

  function set(next: string[], nextFocus?: number) {
    setDigits(next);
    if (nextFocus !== undefined) focus(nextFocus);
    if (next.every(Boolean)) onComplete?.(next.join(""));
  }

  return (
    <div role="group" aria-labelledby={labelledBy} className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
      <input type="hidden" name={name} value={digits.join("")} />
      {digits.map((v, i) => {
        const border = invalid ? "2px solid #B3261E" : i === firstEmpty ? "2px solid #2F5FD0" : v ? "1px solid #121826" : "1px solid #B7BDC9";
        return (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="text" inputMode="numeric" pattern="[0-9]*" maxLength={i === 0 ? length : 2}
            autoComplete={i === 0 ? "one-time-code" : "off"} autoFocus={autoFocus && i === 0}
            aria-label={t("Digit {n} of {total}", { n: i + 1, total: length })} aria-invalid={invalid || undefined}
            value={v} disabled={disabled}
            onChange={(e) => {
              let raw = e.target.value.replace(/[^0-9]/g, "");
              const base = digits.slice();
              if (raw.length === 2 && raw[0] === digits[i]) raw = raw[1];
              if (raw.length > 1) {
                // pasted or autofilled: spread from this box on
                let j = i;
                for (const ch of raw) if (j < length) base[j++] = ch;
                set(base, Math.min(j, length - 1));
                return;
              }
              base[i] = raw;
              set(base, raw && i < length - 1 ? i + 1 : undefined);
            }}
            onPaste={(e) => {
              const raw = e.clipboardData.getData("text").replace(/[^0-9]/g, "");
              if (raw.length < 2) return;
              e.preventDefault();
              const base = digits.slice();
              let j = i;
              for (const ch of raw) if (j < length) base[j++] = ch;
              set(base, Math.min(j, length - 1));
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) { const d = digits.slice(); d[i - 1] = ""; setDigits(d); focus(i - 1); }
              if (e.key === "ArrowLeft" && i > 0) focus(i - 1);
              if (e.key === "ArrowRight" && i < length - 1) focus(i + 1);
            }}
            className="box-border h-[52px] w-full min-w-0 rounded-[4px] bg-white text-center font-mono text-[22px] font-semibold text-[#121826] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5FD0] disabled:opacity-60"
            style={{ border, background: invalid ? "#FFF7F6" : "#FFFFFF" }}
          />
        );
      })}
    </div>
  );
}
