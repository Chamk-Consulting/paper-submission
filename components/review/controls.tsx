"use client";

import { useT } from "@/lib/i18n/client";

/** 1–5 score buttons (radio group). */
export function ScoreButtons({ label, value, onChange, disabled, size = 40 }: { label: string; value: number | undefined; onChange: (v: number) => void; disabled?: boolean; size?: number }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value === n;
        return (
          <button key={n} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(n)}
            style={{ width: size, height: size }}
            className={`rounded-[4px] border text-[15px] font-semibold disabled:cursor-not-allowed ${on ? "border-[#0E1B3D] bg-[#0E1B3D] text-white" : "border-[#B7BDC9] bg-white text-[#121826] hover:bg-[#F7F8F6] disabled:opacity-60"}`}>
            {n}
          </button>
        );
      })}
    </div>
  );
}

/** Pill options (recommendation, confidence, addressed?). colors: value → active colour. */
export function Pills<V extends string>({ label, options, value, onChange, disabled, colors }: {
  label: string; options: [V, string][]; value: V | null | undefined; onChange: (v: V) => void; disabled?: boolean; colors?: Partial<Record<V, string>>;
}) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([k, l]) => {
        const on = value === k;
        const c = colors?.[k] ?? "#0E1B3D";
        return (
          <button key={k} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(k)}
            style={on ? { background: c, borderColor: c } : undefined}
            className={`h-9 rounded-[4px] border px-3.5 text-[14px] font-medium disabled:cursor-not-allowed ${on ? "text-white" : "border-[#DADDE3] bg-white text-[#4A5263] hover:text-[#121826] disabled:opacity-60"}`}>
            {t(l)}
          </button>
        );
      })}
    </div>
  );
}
