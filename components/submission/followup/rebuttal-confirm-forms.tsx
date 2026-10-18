"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { confirmCoauthor, saveRebuttal } from "@/lib/submission/followup-actions";
import type { ActionState } from "@/lib/submission/actions";
import { ghostBtn, primaryBtn } from "@/components/submission/shell";
import { ErrorBox, Saved } from "@/components/submission/followup/bits";
import { useT } from "@/lib/i18n/client";

const MAX = 2000;

/** SB15 — one response per reviewer, 2,000 characters each. */
export function RebuttalForm({ id, reviews, open }: { id: string; reviews: { assignmentId: string; label: string; scores: [string, number][]; review: string; response: string }[]; open: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveRebuttal, {});
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(reviews.map((r) => [r.assignmentId, r.response])));
  const over = Object.values(vals).some((v) => v.length > MAX);
  const payload = JSON.stringify(reviews.map((r) => ({ assignment_id: r.assignmentId, response: vals[r.assignmentId] ?? "" })));
  return (
    <form action={action}>
      <input type="hidden" name="submissionId" value={id} />
      <input type="hidden" name="responses" value={payload} />
      <div className="flex flex-col gap-5">
        {reviews.map((r, i) => {
          const v = vals[r.assignmentId] ?? "";
          return (
            <section key={r.assignmentId} className="rounded-[8px] border border-[#DADDE3] bg-white p-[22px]">
              <details className="group" open={i === 0 && !v}>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                  <span className="font-semibold">{t("{who} · read the review", { who: r.label })}</span>
                  <span className="flex gap-1.5">{r.scores.map(([k, s]) => <span key={k} title={k} className="rounded-[3px] bg-[#EEF0EC] px-1.5 font-mono text-[12px]">{s}</span>)}</span>
                  <span aria-hidden className="ml-auto text-[#4A5263] transition-transform group-open:rotate-180">▾</span>
                </summary>
                <p className="mt-3 whitespace-pre-line rounded-[6px] bg-[#F7F8F6] px-3 py-2 text-[14px] leading-[1.6]">{r.review || "—"}</p>
              </details>
              <div className="mt-4 flex items-baseline justify-between gap-2">
                <label htmlFor={`rb-${r.assignmentId}`} className="font-semibold">{t("Your response to {who}", { who: r.label })}</label>
                <span className={`font-mono text-[13px] ${v.length > MAX ? "text-[#B3261E]" : "text-[#4A5263]"}`}>{t("{n} / 2,000", { n: v.length.toLocaleString(t.intl) })}</span>
              </div>
              <textarea id={`rb-${r.assignmentId}`} rows={5} value={v} disabled={!open} onChange={(e) => setVals((s) => ({ ...s, [r.assignmentId]: e.target.value }))} className="mt-1.5 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 py-2 text-[15px] disabled:bg-[#F7F8F6]" />
            </section>
          );
        })}
      </div>
      {over ? <p role="alert" className="mt-3 text-[14px] text-[#B3261E]">{t("A response is over 2,000 characters.")}</p> : null}
      <ErrorBox msg={state.error} />
      {state.ok ? <p role="status" className="mt-3 rounded-[6px] bg-[#E1F3EA] px-3 py-2 text-[14px] text-[#14603F]">✓ {t("Rebuttal saved. You can edit it until the window closes.")}</p> : null}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/submissions/${id}`} className={ghostBtn}>← {t("Paper status")}</Link>
        <div className="flex items-center gap-3"><Saved at={state.savedAt} />
          <button type="submit" disabled={pending || over || !open} className={primaryBtn}>{pending ? t("Saving…") : t("Submit rebuttal")}</button></div>
      </div>
    </form>
  );
}

/** CA01 — confirm or decline co-authorship. */
export function ConfirmForm({ id, affiliations, current, addedBy }: { id: string; affiliations: string[]; current: string | null; addedBy: string | null }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(confirmCoauthor, {});
  const [result, setResult] = useState<null | "confirmed" | "declined">(null);
  const [aff, setAff] = useState(current ?? affiliations[0] ?? "");
  const [other, setOther] = useState(false);
  const box = "mt-0.5 size-5 flex-none accent-[#0E1B3D]";
  if (state.ok && result === "confirmed") return <p role="status" className="mt-4 rounded-[6px] bg-[#E1F3EA] px-4 py-3 text-[15px] text-[#14603F]">✓ {t("Confirmed. {name} has been told. The paper now shows in My submissions.", { name: addedBy ?? t("The corresponding author") })} <Link href="/workspace/submissions" className="text-[#14603F] underline">{t("My submissions")}</Link></p>;
  if (state.ok && result === "declined") return <p role="status" className="mt-4 rounded-[6px] bg-[#FBEFDD] px-4 py-3 text-[15px] text-[#3B2A07]">{t("You said you are not an author. {name} has been told.", { name: addedBy ?? t("The corresponding author") })}</p>;
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="submissionId" value={id} />
      <label htmlFor="ca-aff" className="block font-semibold">{t("Affiliation as it should appear")}</label>
      {!other && affiliations.length ? (
        <select id="ca-aff" name="affiliation" value={aff} onChange={(e) => { if (e.target.value === "__other") { setOther(true); setAff(""); } else setAff(e.target.value); }} className="mt-1.5 h-11 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-2.5 text-[15px]">
          {affiliations.map((a) => <option key={a} value={a}>{a}</option>)}
          <option value="__other">{t("Add another affiliation…")}</option>
        </select>
      ) : (
        <input id="ca-aff" name="affiliation" value={aff} maxLength={200} onChange={(e) => setAff(e.target.value)} placeholder={t("Institution, city, country")} className="mt-1.5 h-11 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[15px]" />
      )}
      <label className="mt-4 flex gap-3 py-1.5 text-[15px]"><input type="checkbox" name="contributed" className={box} />{t("I contributed to this work and agree to be listed as an author")}</label>
      <label className="flex gap-3 py-1.5 text-[15px]"><input type="checkbox" name="read" className={box} />{t("I have read the submitted version")}</label>
      <label className="flex gap-3 py-1.5 text-[15px]"><input type="checkbox" name="conflicts" className={box} /><span>{t("My conflicts of interest are up to date")}</span></label>
      <ErrorBox msg={state.error} />
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="submit" name="intent" value="confirm" onClick={() => setResult("confirmed")} disabled={pending} className={primaryBtn}>{t("Confirm authorship")}</button>
        <button type="submit" name="intent" value="decline" onClick={() => setResult("declined")} disabled={pending} className={ghostBtn}>{t("I'm not an author")}</button>
      </div>
    </form>
  );
}
