"use client";

import { useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";

/* Small controls shared by the setup1 screens (EM01, EM04, EM05, EM07, EM13). Real inputs, styled like the canvas. */

/** Checkbox drawn as a switch (canvas role="switch" toggles). Submits "on" like a checkbox. */
export function Switch({ name, defaultChecked, label, hint, disabled, onChange }: {
  name: string; defaultChecked?: boolean; label: ReactNode; hint?: ReactNode; disabled?: boolean; onChange?: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-center justify-between gap-4 border-b border-[#EEF0EC] py-3 last:border-0 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span className="min-w-0"><strong className="block text-[15px] font-semibold">{label}</strong>{hint ? <span className="block text-[13px] text-[#4A5263]">{hint}</span> : null}</span>
      <span className="relative inline-flex flex-none">
        <input type="checkbox" role="switch" name={name} defaultChecked={defaultChecked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} className="peer sr-only" />
        <span aria-hidden className="h-6 w-[42px] rounded-full bg-[#B7BDC9] transition-colors peer-checked:bg-[#18744F] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#2F5FD0]" />
        <span aria-hidden className="absolute left-[3px] top-[3px] size-[18px] rounded-full bg-white shadow transition-[left] peer-checked:left-[21px]" />
      </span>
    </label>
  );
}

/** Radio group drawn as cards (canvas role="radio" cards). */
export function RadioCards({ name, options, defaultValue, disabled, columns = 3, onChange }: {
  name: string; options: { value: string; title: string; desc?: string }[]; defaultValue?: string; disabled?: boolean; columns?: 1 | 2 | 3; onChange?: (v: string) => void;
}) {
  const t = useT();
  return (
    <div role="radiogroup" className={`grid gap-2.5 ${columns === 3 ? "sm:grid-cols-3" : columns === 2 ? "sm:grid-cols-2" : ""}`}>
      {options.map((o) => (
        <label key={o.value} className={`flex items-start gap-3 rounded-[8px] border border-[#DADDE3] bg-white p-3.5 has-[:checked]:border-[#0E1B3D] has-[:checked]:bg-[#F7F8F6] has-[:checked]:ring-1 has-[:checked]:ring-[#0E1B3D] ${disabled ? "opacity-60" : "cursor-pointer"}`}>
          <input type="radio" name={name} value={o.value} defaultChecked={defaultValue === o.value} disabled={disabled} onChange={() => onChange?.(o.value)} className="mt-1 size-4 flex-none accent-[#0E1B3D]" />
          <span><strong className="block text-[15px] font-semibold">{t(o.title)}</strong>{o.desc ? <span className="block text-[13px] text-[#4A5263]">{t(o.desc)}</span> : null}</span>
        </label>
      ))}
    </div>
  );
}

/** − n + stepper over a real number input (canvas EM05/EM07 counters). */
export function Stepper({ name, label, hint, defaultValue, min, max, disabled, error }: {
  name: string; label: ReactNode; hint?: ReactNode; defaultValue: number; min: number; max: number; disabled?: boolean; error?: string;
}) {
  const t = useT();
  const [v, setV] = useState(defaultValue);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#EEF0EC] py-3 last:border-0">
      <span className="min-w-0"><label htmlFor={`st-${name}`} className="block text-[15px] font-semibold">{label}</label>{hint ? <span className="block text-[13px] text-[#4A5263]">{hint}</span> : null}
        {error ? <span className="block text-[13px] text-[#B3261E]">{t(error)}</span> : null}</span>
      <span className="flex flex-none items-center gap-1.5">
        <button type="button" aria-label={t("Less")} disabled={disabled || v <= min} onClick={() => setV((x) => clamp(x - 1))} className="size-9 rounded-[4px] border border-[#B7BDC9] bg-white text-[18px] disabled:opacity-40">−</button>
        <input id={`st-${name}`} name={name} type="number" inputMode="numeric" min={min} max={max} value={v} disabled={disabled}
          onChange={(e) => setV(clamp(Number(e.target.value) || min))} className="h-9 w-14 rounded-[4px] border border-[#B7BDC9] bg-white text-center text-[15px] font-semibold [appearance:textfield]" />
        <button type="button" aria-label={t("More")} disabled={disabled || v >= max} onClick={() => setV((x) => clamp(x + 1))} className="size-9 rounded-[4px] border border-[#B7BDC9] bg-white text-[18px] disabled:opacity-40">+</button>
      </span>
    </div>
  );
}

/** "Rules on this page" side card. */
export function Rules({ rules, children }: { rules: [string, string][]; children?: ReactNode }) {
  const t = useT();
  return (
    <aside className="flex w-full flex-col gap-3.5 xl:w-[280px] xl:flex-none">
      {children}
      <section className="rounded-[8px] border border-[#DADDE3] bg-white px-[18px] py-4">
        <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("Rules on this page")}</p>
        <ul className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0">
          {rules.map(([code, text]) => (
            <li key={code} className="flex gap-2.5 text-[13px]"><span className="flex-none rounded-[3px] bg-[#EEF0EC] px-1.5 font-mono text-[11px] leading-[18px] text-[#4A5263]">{code}</span><span>{t(text)}</span></li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

export function LockTag() {
  const t = useT();
  return <span title={t("Locks when submissions open (K3)")} className="ml-2 inline-flex items-center rounded-[3px] bg-[#EEF0EC] px-1.5 py-px align-middle font-mono text-[10px] font-medium uppercase tracking-[0.04em] text-[#4A5263]">{t("Locks at opening")}</span>;
}
