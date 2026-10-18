"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { acceptCounterOffer, cancelExtension, requestExtension, type ActionState } from "@/lib/review/actions";
import { fmtDayYear } from "@/lib/review/shared";
import { ui } from "@/components/manage/ui";

type Opt = "d3" | "d7" | "d14" | "hand_back";
const OPTS: [Opt, string, string][] = [
  ["d3", "3 more days", "Usually approved straight away"],
  ["d7", "7 more days", "The editor decides"],
  ["d14", "14 more days", "Only if the venue allows"],
  ["hand_back", "Hand the review back", "I can't do it — please find someone else"],
];
const DAYS: Record<Opt, number> = { d3: 3, d7: 7, d14: 14, hand_back: 0 };

export type ExtProps = {
  id: string; no: string; ae: string; dueAt: string; handedBack: boolean; draftSummary: string;
  ext: { id: string; option: string; status: string; requested_until: string | null; offered_until: string | null; editor_message: string | null } | null;
};

/** RV06 more time: ask (3/7/14 days or hand back), pending, approved, counter-offer, handed back. */
export function ExtensionPanel(p: ExtProps) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(requestExtension, {});
  const [opt, setOpt] = useState<Opt>("d7");
  const [asking, setAsking] = useState(false);
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const due = new Date(p.dueAt).getTime();
  const plus = (n: number) => fmtDayYear(new Date(due + n * 864e5).toISOString(), t.intl);
  const ext = p.ext;
  const back = opt === "hand_back";

  const run = (fn: () => Promise<ActionState>) => start(async () => { setErr(null); const r = await fn(); if (r.error) setErr(r.error); });
  const label = (o: string) => OPTS.find((x) => x[0] === o)?.[1] ?? o;

  const card = "rounded-[8px] border bg-white p-[22px]";
  const stamp = (tone: string, text: string) => <span className={`inline-flex rounded-[3px] px-1.5 py-px font-mono text-[11px] font-medium uppercase tracking-[0.04em] ${tone}`}>{text}</span>;

  if (p.handedBack || state.result === "handed_back") {
    return (
      <section className={`${card} border-[#DADDE3]`}>
        <h2 className={ui.h2}>{t("Review handed back")}</h2>
        <p className="mb-0 mt-2 text-[15px] text-[#4A5263]">{t("{no} is no longer in your list. Thank you for saying so early — it helps the authors get a decision on time.", { no: p.no })}</p>
        <Link href="/reviews" className={`${ui.ghost} mt-4`}>{t("Back to Reviews")}</Link>
      </section>
    );
  }

  if (!asking && ext?.status === "pending") {
    return (
      <section className={`${card} border-[#C9D6F5]`}>
        {stamp("bg-[#E6EDFC] text-[#1F47A8]", t("WAITING FOR THE EDITOR"))}
        <h2 className={`${ui.h2} mt-2`}>{t("You asked for {x}", { x: t(label(ext.option)).toLowerCase() })}</h2>
        <p className="mb-0 mt-2 text-[15px] text-[#4A5263]">{t("Until the editor answers, your due date stays {d}. Editors usually reply within a day. Keep going in the meantime — your draft is safe.", { d: fmtDayYear(p.dueAt, t.intl) })}</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link href={`/reviews/${p.id}`} className={ui.primary}>{t("Continue the review")}</Link>
          <button type="button" disabled={busy} onClick={() => run(() => cancelExtension(p.id, ext.id))} className={ui.ghost}>{t("Cancel request")}</button>
        </div>
        {err ? <p role="alert" className="mb-0 mt-2 text-[14px] text-[#B3261E]">{t(err)}</p> : null}
      </section>
    );
  }

  if (!asking && ext?.status === "counter_offered" && ext.offered_until) {
    const offered = fmtDayYear(ext.offered_until, t.intl);
    const days = Math.max(1, Math.round((new Date(ext.offered_until).getTime() - due) / 864e5));
    return (
      <section className={`${card} border-[#F1D29A]`}>
        {stamp("bg-[#FBEFDD] text-[#7A4508]", t("NOT POSSIBLE"))}
        <h2 className={`${ui.h2} mt-2`}>{t("The editor can give you {n} days, not {m}", { n: days, m: DAYS[(ext.option as Opt)] || "?" })}</h2>
        {ext.editor_message ? <p className="mb-0 mt-2 text-[15px] text-[#4A5263]">{p.ae}: “{ext.editor_message}”</p> : null}
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button type="button" disabled={busy} onClick={() => run(() => acceptCounterOffer(p.id, ext.id))} className={ui.primary}>{t("Accept {d}", { d: offered })}</button>
          <button type="button" onClick={() => { setOpt("hand_back"); setAsking(true); }} className={ui.ghost}>{t("Hand the review back")}</button>
        </div>
        {err ? <p role="alert" className="mb-0 mt-2 text-[14px] text-[#B3261E]">{t(err)}</p> : null}
      </section>
    );
  }

  const approved = !asking && (state.result === "approved" || ext?.status === "approved" || ext?.status === "accepted_counter");
  const refused = !asking && ext?.status === "refused";

  return (
    <>
      {approved ? (
        <section className={`${card} border-[#B9E0CB]`}>
          {stamp("bg-[#E1F3EA] text-[#14603F]", t("APPROVED"))}
          <h2 className={`${ui.h2} mt-2`}>{t("New due date: {d}", { d: fmtDayYear(p.dueAt, t.intl) })}</h2>
          {ext?.editor_message ? <p className="mb-0 mt-2 text-[15px] text-[#4A5263]">{p.ae}: “{ext.editor_message}”</p> : null}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href={`/reviews/${p.id}`} className={ui.primary}>{t("Continue the review")}</Link>
            <button type="button" onClick={() => setAsking(true)} className={ui.ghost}>{t("Ask again")}</button>
          </div>
        </section>
      ) : null}
      {refused ? <div className={ui.warn}>{t("The editor couldn't extend the due date.")}{ext?.editor_message ? ` ${p.ae}: “${ext.editor_message}”` : ""}</div> : null}
      {approved ? null : (
        <form action={action} className={`${card} flex flex-col gap-4 border-[#DADDE3]`}>
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="option" value={opt} />
          {state.result === "pending" ? <div className={ui.ok}>{t("Request sent. The editor usually replies within a day.")}</div> : null}
          <h2 className={ui.h2}>{t("What would help?")}</h2>
          <div role="radiogroup" aria-label={t("What would help?")} className="flex flex-col gap-2">
            {OPTS.map(([k, l, d]) => {
              const on = opt === k;
              const hb = k === "hand_back";
              return (
                <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setOpt(k)}
                  className={`flex items-center gap-3 rounded-[6px] border px-3.5 py-3 text-left ${on ? (hb ? "border-[#F2A93B] bg-[#FFFAF2]" : "border-[#2F5FD0] bg-[#FBFCFF]") : "border-[#DADDE3] bg-white"}`}>
                  <span aria-hidden className="size-4 flex-none rounded-full bg-white" style={{ border: on ? `5px solid ${hb ? "#F2A93B" : "#2F5FD0"}` : "1.5px solid #8A93A6" }} />
                  <span className="flex-auto">
                    <span className="block text-[15px] font-medium">{t(l)}</span>
                    <span className="block text-[13px] text-[#4A5263]">{t(d)}</span>
                  </span>
                  {DAYS[k] ? <span className="font-mono text-[13px] text-[#4A5263]">→ {plus(DAYS[k])}</span> : null}
                </button>
              );
            })}
          </div>
          <label className={ui.label}>
            {t("Message to {ae} (optional)", { ae: p.ae })}
            <textarea name="message" rows={3} maxLength={2000} placeholder={t("e.g. Travelling for a conference until 22 Oct.")} className={ui.textarea} />
          </label>
          {back ? (
            <>
              <div className={ui.warn}>{t("Handing back can't be undone. Your draft ({d}) is deleted and the editor finds another reviewer.", { d: p.draftSummary })}</div>
              <label className={ui.label}>
                {t("Suggest a replacement (optional)")}
                <input name="suggestion" maxLength={300} placeholder={t("Name, email or Plenary ID")} className={ui.input} />
              </label>
            </>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending}
              className={back ? "inline-flex h-[42px] items-center rounded-[4px] border-0 bg-[#B3261E] px-4 text-[14px] font-semibold text-white disabled:opacity-60" : ui.primary}>
              {back ? t("Hand back {no}", { no: p.no }) : t("Send request")}
            </button>
            <Link href={`/reviews/${p.id}`} className="text-[14px] text-[#2F5FD0]">{t("Back to the review")}</Link>
          </div>
          {state.error ? <p role="alert" className="m-0 text-[14px] text-[#B3261E]">{t(state.error)}</p> : null}
        </form>
      )}
    </>
  );
}
