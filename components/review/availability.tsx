"use client";

import { useActionState, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { saveAvailability, type ActionState } from "@/lib/review/actions";

/** RV01 aside "How busy are you?" — saves persons.availability / available_from / monthly_limit. */
export function AvailabilityForm({ initial }: { initial: { availability: "normal" | "low" | "off"; available_from: string | null } }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAvailability, {});
  const [v, setV] = useState(initial.availability);
  const [from, setFrom] = useState(initial.available_from ?? "");
  const opts: ["normal" | "low" | "off", string][] = [
    ["normal", t("Available — up to 4 papers a month")],
    ["low", t("Busy — 1 paper a month")],
    ["off", t("Not reviewing until")],
  ];
  return (
    <form action={action} className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5">
      <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("How busy are you?")}</p>
      <p className="mb-2 mt-1 text-[13px] text-[#4A5263]">{t("Editors see this before they invite you.")}</p>
      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="sr-only">{t("How busy are you?")}</legend>
        {opts.map(([k, l]) => (
          <label key={k} className={`flex cursor-pointer flex-wrap items-center gap-2 rounded-[6px] border px-3 py-2 text-[14px] ${v === k ? "border-[#2F5FD0] bg-[#FBFCFF]" : "border-[#DADDE3]"}`}>
            <input type="radio" name="availability" value={k} checked={v === k} onChange={() => setV(k)} className="accent-[#2F5FD0]" />
            <span>{l}</span>
            {k === "off" && v === "off" ? (
              <input type="date" name="available_from" aria-label={t("Not reviewing until")} required value={from} onChange={(e) => setFrom(e.target.value)}
                className="h-8 rounded-[4px] border border-[#B7BDC9] px-2 text-[13px]" />
            ) : null}
          </label>
        ))}
      </fieldset>
      <div className="mt-2.5 flex items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex h-9 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px] font-medium hover:bg-[#F7F8F6] disabled:opacity-60">
          {pending ? t("Saving…") : t("Save")}
        </button>
        <span role="status" className={`text-[13px] ${state.error ? "text-[#B3261E]" : "text-[#14603F]"}`}>
          {state.error ? t(state.error) : state.ok ? t("Saved") : ""}
        </span>
      </div>
    </form>
  );
}
