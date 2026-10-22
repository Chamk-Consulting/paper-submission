"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/lib/i18n/client";
import type { AccountState } from "@/lib/account/actions";

/* Sticky save bar of the settings forms (canvas ST01/ST03/ST04): status on the left, "Save changes" on the right. Put inside the <form>. */
export function AccountSaveBar({ state, dirty }: { state: AccountState; dirty: boolean }) {
  const t = useT();
  const { pending } = useFormStatus();
  const hasFieldErrors = !!state.fieldErrors && Object.keys(state.fieldErrors).length > 0;
  const savedNow = !dirty && !state.error && !hasFieldErrors && !!state.savedAt;
  return (
    <div className="sticky bottom-0 z-10 mt-1 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3">
      <span role="status" data-form-error={state.error || hasFieldErrors ? "" : undefined} className={`text-[13px] ${state.error || hasFieldErrors ? "text-[#B3261E]" : savedNow ? "text-[#14603F]" : "text-[#4A5263]"}`}>
        {pending ? t("Saving…")
          : state.error ? t(state.error)
          : hasFieldErrors ? t("Check the highlighted fields.")
          : savedNow ? t("Saved just now.")
          : dirty ? t("Changes are not saved yet.") : ""}
      </span>
      <button type="submit" disabled={pending} className="inline-flex h-[42px] items-center rounded-[4px] border-0 bg-[#F2A93B] px-[18px] text-[15px] font-semibold text-[#0E1B3D] hover:bg-[#E89B26] disabled:opacity-60">
        {t("Save changes")}
      </button>
    </div>
  );
}

/** Tracks unsaved edits: changes after the last submit make the form dirty. */
export function useDirty() {
  const [changed, setChanged] = useState(0);
  const [submitted, setSubmitted] = useState(0);
  return {
    dirty: changed > submitted,
    onChange: () => setChanged((n) => Math.max(n, submitted) + 1),
    onSubmit: () => setSubmitted(changed),
  };
}

export function FieldErr({ state, name }: { state: AccountState; name: string }) {
  const t = useT();
  const e = state.fieldErrors?.[name];
  return e ? <span className="text-[13px] font-normal text-[#B3261E]">{t(e)}</span> : null;
}

/** The same bar for pages whose Save sits outside the form (or isn't a form): state comes in as props.
 * With `form`, the button submits that form by id; otherwise `onSave` runs. */
export function ManualSaveBar({ pending, dirty, error, savedAt, form, onSave, note }: {
  pending: boolean; dirty: boolean; error?: string; savedAt?: string; form?: string; onSave?: () => void; note?: string;
}) {
  const t = useT();
  const savedNow = !dirty && !error && !!savedAt;
  return (
    <div className="sticky bottom-0 z-10 mt-1 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3">
      <span role="status" className={`text-[13px] ${error ? "text-[#B3261E]" : savedNow ? "text-[#14603F]" : "text-[#4A5263]"}`}>
        {pending ? t("Saving…") : error ? t(error) : savedNow ? t("Saved just now.") : dirty ? t("Changes are not saved yet.") : note ? t(note) : ""}
      </span>
      <button type={form ? "submit" : "button"} form={form} onClick={form ? undefined : onSave} disabled={pending}
        className="inline-flex h-[42px] cursor-pointer items-center rounded-[4px] border-0 bg-[#F2A93B] px-[18px] text-[15px] font-semibold text-[#0E1B3D] hover:bg-[#E89B26] disabled:opacity-60">
        {t("Save changes")}
      </button>
    </div>
  );
}
