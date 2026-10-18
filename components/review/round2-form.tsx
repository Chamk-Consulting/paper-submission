"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { saveReview } from "@/lib/review/actions";
import { RECS_R2, type Rec } from "@/lib/review/shared";
import { Pills } from "@/components/review/controls";
import { ui } from "@/components/manage/ui";

type Addr = "yes" | "partly" | "no";
const ADDR: [Addr, string][] = [["yes", "Yes"], ["partly", "Partly"], ["no", "No"]];
const ADDR_COLORS: Record<Addr, string> = { yes: "#18744F", partly: "#A8600F", no: "#B3261E" };

export type R2Item = { n: number; mine: string; response: string | null; where: string | null };

/** RV09 — check each round-1 comment, remaining concerns, round-2 recommendation. */
export function Round2Form({ id, items, initial, readOnly }: {
  id: string; items: R2Item[]; readOnly: boolean;
  initial: { addressed: Record<number, Addr>; remaining: string; recommendation: Rec | null; scores: Record<string, number>; confidence: "low" | "medium" | "high" | null; to_authors: string; to_editor: string };
}) {
  const t = useT();
  const router = useRouter();
  const [addr, setAddr] = useState<Record<number, Addr>>(initial.addressed);
  const [remaining, setRemaining] = useState(initial.remaining);
  const [rec, setRec] = useState<Rec | null>(initial.recommendation);
  const [tried, setTried] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const marked = items.filter((i) => addr[i.n]).length;
  const ok = marked === items.length && !!rec;

  const save = (submit: boolean, then: string) => start(async () => {
    setErr(null);
    const r = await saveReview({
      id, scores: initial.scores, recommendation: rec, confidence: initial.confidence, to_authors: initial.to_authors, to_editor: initial.to_editor,
      submit, round2: items.filter((i) => addr[i.n]).map((i) => ({ n: i.n, addressed: addr[i.n] })), remaining: remaining.trim() || null,
    });
    if (r.error) setErr(r.error); else router.push(then);
  });

  return (
    <>
      <section className={ui.card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={ui.h2}>{t("Your round-1 comments")}</h2>
          <span className={`font-mono text-[12px] ${marked === items.length ? "text-[#14603F]" : "text-[#A8600F]"}`}>{t("{n} of {m} checked", { n: marked, m: items.length })}</span>
        </div>
        {items.length === 0 ? <p className="mb-0 mt-2 text-[14px] text-[#4A5263]">{t("The authors didn't list responses to individual comments. Read the revised paper and give your recommendation.")}</p> : null}
        <ol className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
          {items.map((i) => (
            <li key={i.n} className={`rounded-[6px] border border-[#DADDE3] px-4 py-3 ${addr[i.n] ? "bg-white" : "bg-[#FFFCF5]"}`}>
              <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Your comment {n}", { n: i.n })}</p>
              <p className="mb-0 mt-1 whitespace-pre-line text-[15px]">{i.mine}</p>
              {i.response ? (
                <p className="mb-0 mt-2 rounded-[4px] border-l-[3px] border-[#C9D6F5] bg-[#F7F9FE] px-3 py-2 text-[14px]">
                  <span className="block text-[12px] font-medium text-[#1F47A8]">{t("Authors' response")}{i.where ? ` · ${i.where}` : ""}</span>
                  {i.response}
                </p>
              ) : null}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-[#4A5263]">{t("Addressed?")}</span>
                <Pills label={t("Addressed?")} options={ADDR} colors={ADDR_COLORS} value={addr[i.n]} disabled={readOnly} onChange={(v) => setAddr({ ...addr, [i.n]: v })} />
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className={ui.card}>
        <h2 className={ui.h2}><label htmlFor="r2-rem">{t("Remaining concerns")} <span className="text-[15px] text-[#4A5263]">{t("(optional)")}</span></label></h2>
        <textarea id="r2-rem" value={remaining} readOnly={readOnly} onChange={(e) => setRemaining(e.target.value)} rows={5} maxLength={10000}
          placeholder={t("Anything still missing, or new issues from the revision")} className={`${ui.textarea} mt-2 w-full`} />
        <p className="mb-1.5 mt-4 text-[15px] font-medium">{t("Recommendation")}</p>
        <Pills label={t("Recommendation")} options={RECS_R2} value={rec} disabled={readOnly} onChange={setRec} />
      </section>
      {readOnly ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={pending} onClick={() => save(false, "/reviews")} className={ui.ghost}>{t("Save and close")}</button>
          <button type="button" disabled={pending} onClick={() => { setTried(true); if (ok) save(true, `/reviews/${id}/submitted`); }} className={ui.primary}>{t("Submit round-2 review")}</button>
          {tried && !ok ? <span role="alert" className="text-[14px] text-[#B3261E]">{marked < items.length ? t("Check every comment first.") : t("Choose a recommendation.")}</span> : null}
          {err ? <span role="alert" className="text-[14px] text-[#B3261E]">{t(err)}</span> : null}
          <Link href={`/reviews/${id}/paper`} className="ml-auto text-[14px] text-[#2F5FD0]">{t("Read v2")}</Link>
        </div>
      )}
    </>
  );
}
