"use client";

import Link from "@/components/site/link";
import { useActionState, useState } from "react";
import { saveRevision } from "@/lib/submission/followup-actions";
import type { ActionState } from "@/lib/submission/actions";
import { ghostBtn, primaryBtn } from "@/components/submission/shell";
import { ErrorBox, FieldError, Saved } from "@/components/submission/followup/bits";
import { useT } from "@/lib/i18n/client";

export type RevItem = { key: string; assignmentId: string | null; ordinal: string; no: number; quote: string; response: string; changedIn: string };

/** SB14 — respond to each reviewer comment. */
export function RespondForm({ id, items: initial }: { id: string; items: RevItem[] }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveRevision, {});
  const [items, setItems] = useState(initial);
  const answered = items.filter((i) => i.response.trim().length > 5).length;
  const set = (k: string, patch: Partial<RevItem>) => setItems((list) => list.map((i) => (i.key === k ? { ...i, ...patch } : i)));
  const payload = JSON.stringify(items.map((i) => ({ assignment_id: i.assignmentId, comment_no: i.no, quote: i.quote || undefined, response: i.response, changed_in: i.changedIn || undefined })));
  return (
    <form action={action}>
      <input type="hidden" name="submissionId" value={id} />
      <input type="hidden" name="responses" value={payload} />
      <p className="m-0 font-mono text-[12px] uppercase tracking-[0.06em] text-[#4A5263]">{t("{n} of {total} answered", { n: answered, total: items.length })}</p>
      <ol className="m-0 mt-3 flex list-none flex-col gap-5 p-0">
        {items.map((c) => (
          <li key={c.key} className="rounded-[8px] border border-[#EEF0EC] p-4">
            <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] font-semibold">
              {c.ordinal ? t("{who} · comment {n}", { who: c.ordinal, n: c.no }) : t("General response")}
              {c.response.trim().length > 5 ? <span className="rounded-[3px] bg-[#E1F3EA] px-1.5 font-mono text-[11px] uppercase text-[#14603F]">{t("Answered")}</span> : null}
            </p>
            {c.quote ? <blockquote className="m-0 mt-2 border-l-[3px] border-[#DADDE3] pl-3 text-[14px] text-[#4A5263]">{c.quote}</blockquote> : null}
            <label htmlFor={`r-${c.key}`} className="mt-3 block text-[14px] font-semibold">{t("Your response")}</label>
            <textarea id={`r-${c.key}`} rows={3} maxLength={6000} value={c.response} onChange={(e) => set(c.key, { response: e.target.value })} className="mt-1 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 py-2 text-[15px]" />
            <label htmlFor={`l-${c.key}`} className="mt-2 block text-[14px] font-semibold">{t("Changed in")}</label>
            <input id={`l-${c.key}`} maxLength={200} value={c.changedIn} placeholder={t("e.g. Sec. III-B, p. 4")} onChange={(e) => set(c.key, { changedIn: e.target.value })} className="mt-1 h-10 w-full max-w-[320px] rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[15px]" />
          </li>
        ))}
      </ol>
      <ErrorBox msg={state.error} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/submissions/${id}/revision`} className={ghostBtn}>← {t("Decision & reviews")}</Link>
        <div className="flex flex-wrap items-center gap-3">
          <Saved at={state.savedAt} />
          <button type="submit" name="intent" value="save" disabled={pending} className={ghostBtn}>{t("Save draft")}</button>
          <button type="submit" name="intent" value="files" disabled={pending} className={primaryBtn}>{pending ? t("Saving…") : `${t("Continue to revised files")} →`}</button>
        </div>
      </div>
    </form>
  );
}

/** SB14b — "What changed" list. */
export function ChangeSummaryForm({ id, items: initial }: { id: string; items: string[] }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveRevision, {});
  const [items, setItems] = useState(initial.length ? initial : [""]);
  const clean = items.map((s) => s.trim()).filter(Boolean).map((item) => ({ item }));
  return (
    <form action={action}>
      <input type="hidden" name="submissionId" value={id} />
      <input type="hidden" name="summary" value={JSON.stringify(clean)} />
      <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <label className="sr-only" htmlFor={`chg-${i}`}>{t("Change {n}", { n: i + 1 })}</label>
            <input id={`chg-${i}`} value={s} maxLength={300} placeholder={t("e.g. Sec. IV-C — new subsection on rate bounds (R3)")} onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? e.target.value : x)))} className="h-10 min-w-0 flex-auto rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[15px]" />
            <button type="button" aria-label={t("Remove")} onClick={() => setItems((l) => (l.length > 1 ? l.filter((_, j) => j !== i) : [""]))} className="h-10 w-10 rounded-[4px] border border-[#DADDE3] bg-white text-[#4A5263]">×</button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {items.length < 30 ? <button type="button" onClick={() => setItems((l) => [...l, ""])} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px]">+ {t("Add a change")}</button> : null}
        <button type="submit" name="intent" value="save" disabled={pending} className="h-9 rounded-[4px] bg-[#0E1B3D] px-3 text-[14px] font-semibold text-white">{pending ? t("Saving…") : t("Save list")}</button>
        <Saved at={state.savedAt} />
      </div>
      <ErrorBox msg={state.error} />
    </form>
  );
}

/** SB14c — submit. */
export function RevisionSubmitForm({ id, ready }: { id: string; ready: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveRevision, {});
  const box = "mt-0.5 size-5 flex-none accent-[#0E1B3D]";
  return (
    <form action={action} className="mt-5">
      <input type="hidden" name="submissionId" value={id} />
      <label className="flex gap-3 py-2 text-[15px]"><input type="checkbox" name="agree" className={box} />{t("All co-authors have read and agree with this revision")}</label>
      <FieldError msg={state.fieldErrors?.agree} />
      <label className="flex gap-3 py-2 text-[15px]"><input type="checkbox" name="notify" defaultChecked className={box} />{t("Email my co-authors a copy of the response letter")}</label>
      <ErrorBox msg={state.error} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/submissions/${id}/revision/files`} className={ghostBtn}>← {t("Revised files")}</Link>
        <button type="submit" name="intent" value="submit" disabled={pending || !ready} className={primaryBtn}>{pending ? t("Submitting…") : t("Submit revision")}</button>
      </div>
    </form>
  );
}
