"use client";

import Link from "@/components/site/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { saveRecommendation } from "@/lib/manage/ops1-actions";
import { wordCount, DECISION_COLOR } from "@/lib/manage/ops1-shared";

/* EM24 — AE summary for the authors, recommendation and confidential note (F1, F2, F6). */

const OPTS: [string, string][] = [["accept_oral", "Accept · oral"], ["accept_poster", "Accept · poster"], ["conditional", "Conditional"], ["reject", "Reject"]];

export function RecommendForm({ slug, submission, initial, reviewsIn, min, backHref }: {
  slug: string; submission: string; initial: { summary: string; recommendation: string | null; note: string | null; sentAt: string | null } | null; reviewsIn: number; min: number; backHref: string;
}) {
  const t = useT();
  const router = useRouter();
  const [text, setText] = useState(initial?.summary ?? "");
  const [rec, setRec] = useState<string | null>(initial?.recommendation ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [tried, setTried] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(initial?.sentAt ? { ok: true, text: t("Recommendation sent to the program chair. You can still edit it until the decision is made.") } : null);
  const [pending, start] = useTransition();
  const words = wordCount(text);
  const enoughReviews = reviewsIn >= min;
  const ok = words >= 60 && !!rec && enoughReviews;
  const missing = !enoughReviews ? t("Needs {n} reviews first (has {m}) (F2).", { n: min, m: reviewsIn }) : words < 60 ? t("{n} more words in the summary.", { n: 60 - words }) : t("Choose a recommendation.");

  function save(send: boolean) {
    if (send && !ok) { setTried(true); return; }
    start(async () => {
      const r = await saveRecommendation({ slug, submission, summary: text, rec: rec as "accept_oral" | null, note, send });
      if (r.error) { setMsg({ ok: false, text: t(r.error) }); return; }
      setMsg({ ok: true, text: send ? t("Recommendation sent to the program chair. You can still edit it until the decision is made.") : t("Draft saved.") });
      setTried(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={ui.card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="rec-summary" className="text-[16px] font-semibold">{t("Summary for the authors")}</label>
          <span className="font-mono text-[12px]" style={{ color: words >= 60 ? "#14603F" : "#A8600F" }}>{t("{n} words · min 60", { n: words })}</span>
        </div>
        <p className={`${ui.hint} m-0 mt-1`}>{t("Goes into the decision letter. Say what decided it and what must change.")}</p>
        <textarea id="rec-summary" value={text} onChange={(e) => setText(e.target.value)} rows={7} className={`${ui.textarea} mt-2 w-full`} />

        <fieldset className="m-0 mt-5 border-0 p-0">
          <legend className="p-0 text-[16px] font-semibold">{t("Recommendation")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {OPTS.map(([k, l]) => {
              const on = rec === k, c = DECISION_COLOR[k];
              return (
                <button key={k} type="button" aria-pressed={on} onClick={() => setRec(on ? null : k)} className="h-10 rounded-[4px] px-4 text-[14px] font-semibold"
                  style={{ background: on ? c : "#FFFFFF", color: on ? "#FFFFFF" : "#4A5263", border: `1px solid ${on ? c : "#DADDE3"}` }}>{t(l)}</button>
              );
            })}
          </div>
        </fieldset>

        <label className={`${ui.label} mt-5`}>{t("Confidential note to the program chair (authors never see this, F6)")}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={ui.textarea} />
        </label>

        {tried && !ok ? <p role="alert" className={`${ui.bad} mt-4`}>{missing}</p> : null}
        {msg ? <p role="status" className={`${msg.ok ? ui.ok : ui.bad} mt-4`}>{msg.text}</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link href={backHref} className="mr-auto text-[14px]">← {t("Reviewers for this paper")}</Link>
          <button type="button" disabled={pending} onClick={() => save(false)} className={ui.ghost}>{t("Save draft")}</button>
          <button type="button" disabled={pending} onClick={() => save(true)} aria-disabled={!ok} className={ok ? ui.primary : `${ui.primary} opacity-60`}>{t("Send recommendation")}</button>
        </div>
      </section>
    </div>
  );
}
