"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveEditFields, saveEditVersion } from "@/lib/submission/followup-actions";
import type { ActionState } from "@/lib/submission/actions";
import { ghostBtn, primaryBtn } from "@/components/submission/shell";
import { ErrorBox, FieldError, Saved } from "@/components/submission/followup/bits";
import { useT } from "@/lib/i18n/client";

const input = "mt-1.5 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[15px]";
const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** SB10 — inline edit of title, short title and abstract. */
export function EditFieldsForm({ id, title: t0, abstract: a0, shortTitle: s0 }: { id: string; title: string; abstract: string; shortTitle: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveEditFields, {});
  const [title, setTitle] = useState(t0);
  const [abs, setAbs] = useState(a0);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action}>
      <input type="hidden" name="submissionId" value={id} />
      <label htmlFor="ed-title" className="block font-semibold">{t("Title")}</label>
      <input id="ed-title" name="title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className={`${input} h-12`} aria-describedby="ed-title-h" />
      <p id="ed-title-h" className="mt-1 text-[13px] text-[#4A5263]">{t("{n} / 200 characters · use Title Case as in the PDF", { n: title.length })}</p>
      <FieldError msg={fe.title} />
      <label htmlFor="ed-short" className="mt-4 block font-semibold">{t("Short title (optional)")}</label>
      <input id="ed-short" name="shortTitle" defaultValue={s0} maxLength={80} className={`${input} h-11`} />
      <label htmlFor="ed-abs" className="mt-4 block font-semibold">{t("Abstract")}</label>
      <textarea id="ed-abs" name="abstract" rows={8} value={abs} onChange={(e) => setAbs(e.target.value)} className={`${input} py-2.5 leading-[1.55]`} />
      <p className={`mt-1 text-[13px] ${words(abs) > 250 ? "text-[#B3261E]" : "text-[#4A5263]"}`}>{t("{n} / 250 words", { n: words(abs) })}</p>
      <FieldError msg={fe.abstract} />
      <ErrorBox msg={state.error} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" name="intent" value="save" disabled={pending} className="h-10 rounded-[4px] border border-[#B7BDC9] bg-white px-4 text-[15px] font-medium">{pending ? t("Saving…") : t("Save changes")}</button>
        <Saved at={state.savedAt} />
      </div>
    </form>
  );
}

/** SB10b — confirm and save as a new version. */
export function EditReviewForm({ id, next }: { id: string; next: number }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveEditVersion, {});
  const box = "mt-0.5 size-5 flex-none accent-[#0E1B3D]";
  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="submissionId" value={id} />
      <label className="flex gap-3 py-2 text-[15px]"><input type="checkbox" name="notify" defaultChecked className={box} /><span>{t("Email my co-authors a summary")}<span className="block text-[13px] text-[#4A5263]">{t("They also see the new version in Plenary.")}</span></span></label>
      <label className="flex gap-3 py-2 text-[15px]"><input type="checkbox" name="agree" className={box} /><span>{t("All co-authors agree with these changes")}</span></label>
      <FieldError msg={state.fieldErrors?.agree} />
      <ErrorBox msg={state.error} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/submissions/${id}/edit`} className={ghostBtn}>← {t("Back to editing")}</Link>
        <button type="submit" disabled={pending} className={primaryBtn}>{pending ? t("Saving…") : t("Save as version {n}", { n: next })}</button>
      </div>
    </form>
  );
}
