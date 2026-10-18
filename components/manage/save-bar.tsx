"use client";

import { useFormStatus } from "react-dom";
import { useLocale, useT } from "@/lib/i18n/client";
import { INTL } from "@/lib/i18n/config";
import type { ManageState } from "@/lib/manage/actions-util";

/* "Save" / "Save and mark ready" bar for setup pages (canvas K2). Put inside the <form>. */
export function SaveBar({ state, status, last, readOnly = false }: {
  state: ManageState; status: "not_started" | "in_progress" | "ready"; last: { at: string | null; by: string | null }; readOnly?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const { pending } = useFormStatus();
  const when = last.at ? new Date(last.at).toLocaleString(INTL[locale], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null;
  const ready = state.ready ?? status === "ready";
  return (
    <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#DADDE3] bg-[#F5F6F3]/95 py-3.5 backdrop-blur">
      <p role="status" className="m-0 text-[13px] text-[#4A5263]">
        {state.error ? <span className="text-[#B3261E]">{t(state.error)}</span>
          : state.savedAt ? (ready ? t("Marked ready · you, just now") : t("Saved just now"))
          : when ? t("Last changed by {who} · {when}", { who: last.by ?? t("someone"), when }) : t("Not saved yet")}
      </p>
      {readOnly ? <span className="text-[13px] text-[#4A5263]">{t("Read-only for your role")}</span> : (
        <div className="flex flex-wrap gap-2">
          <button type="submit" name="intent" value="save" disabled={pending} className="inline-flex h-11 items-center rounded-[4px] border border-[#B7BDC9] bg-white px-4 text-[15px] font-medium text-[#121826] disabled:opacity-60">{pending ? t("Saving…") : t("Save")}</button>
          {ready ? (
            <button type="submit" name="intent" value="undo" disabled={pending} className="inline-flex h-11 items-center rounded-[4px] border-0 bg-[#E1F3EA] px-4 text-[15px] font-semibold text-[#14603F] disabled:opacity-60">{t("Ready ✓ (undo)")}</button>
          ) : (
            <button type="submit" name="intent" value="ready" disabled={pending} className="inline-flex h-11 items-center rounded-[4px] border-0 bg-[#0E1B3D] px-4 text-[15px] font-semibold text-white disabled:opacity-60">{t("Save and mark ready")}</button>
          )}
        </div>
      )}
    </div>
  );
}

export function FieldError({ state, name }: { state: ManageState; name: string }) {
  const t = useT();
  const e = state.fieldErrors?.[name];
  return e ? <span className="text-[13px] font-normal text-[#B3261E]">{t(e)}</span> : null;
}
