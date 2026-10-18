"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { setDecision } from "@/lib/manage/ops1-actions";
import { paperId, recTone, scoreTone, toCsv, AE_REC_LABEL, DECISION_COLOR, DECISION_LABEL, DECISION_SHORT, DECISIONS } from "@/lib/manage/ops1-shared";

/* EM26 — decision table: scores, average, spread, AE recommendation, draft decisions (F1, F2, F4). */

export type DecisionRow = { id: string; number: number | null; title: string; topic: string | null; scores: number[]; avg: number | null; spread: number | null; aeRec: string | null; decision: string | null; released: boolean; reviewsIn: number };

export function DecisionTable({ slug, rows, min, canChangeReleased }: { slug: string; rows: DecisionRow[]; min: number; canChangeReleased: boolean }) {
  const t = useT();
  const router = useRouter();
  const [f, setF] = useState("all");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [opt, setOpt] = useOptimistic(rows, (cur: DecisionRow[], u: { id: string; d: string | null }) => cur.map((r) => (r.id === u.id ? { ...r, decision: u.d } : r)));

  const can = (r: DecisionRow) => r.reviewsIn >= min;
  const list = opt.filter((r) => f === "all" || (f === "und" && !r.decision && can(r)) || (f === "split" && can(r) && (r.spread ?? 0) >= 2) || (f === "blocked" && !can(r)));
  const decided = opt.filter((r) => r.decision && r.decision !== "desk_reject");
  const acc = decided.filter((r) => r.decision!.startsWith("accept") || r.decision === "conditional").length;
  const und = opt.filter((r) => !r.decision && can(r)).length;
  const blocked = opt.filter((r) => !can(r) && !r.decision).length;

  function pick(r: DecisionRow, d: string) {
    const next = r.decision === d ? null : d;
    setErr(null);
    start(async () => {
      setOpt({ id: r.id, d: next });
      const res = await setDecision({ slug, submission: r.id, decision: next as "reject" | null });
      if (res.error) setErr(`${paperId(r.number)}: ${t(res.error)}`);
      router.refresh();
    });
  }
  function exportCsv() {
    const csv = toCsv(["ID", "Title", "Topic", "Scores", "Average", "Spread", "AE recommends", "Decision", "Released"],
      list.map((r) => [paperId(r.number), r.title, r.topic, r.scores.join(" "), r.avg?.toFixed(2) ?? "", r.spread?.toFixed(1) ?? "", r.aeRec ?? "", r.decision ? DECISION_LABEL[r.decision] : "", r.released ? "yes" : "no"]));
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: `${slug}-decisions.csv` }).click();
    URL.revokeObjectURL(url);
  }
  const FILTERS: [string, string][] = [["all", t("All")], ["und", t("Undecided")], ["split", t("Reviewers disagree")], ["blocked", t("Can’t decide yet")]];
  const cols = Math.max(min, ...opt.map((r) => r.scores.length));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5">
          <p className="m-0 text-[13px] text-[#4A5263]">{t("Acceptance rate")}</p>
          <p className="m-0 mt-0.5 font-serif text-[30px] leading-[1.15]">{decided.length ? Math.round((acc / decided.length) * 100) : 0}%</p>
          <p className="m-0 text-[12px] text-[#4A5263]">{t("{a} of {b} decided papers", { a: acc, b: decided.length })}</p>
        </div>
        <div className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5"><p className="m-0 text-[13px] text-[#4A5263]">{t("Undecided")}</p><p className="m-0 mt-0.5 font-serif text-[30px] leading-[1.15]" style={{ color: und ? "#A8600F" : "#14603F" }}>{und}</p></div>
        <div className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5"><p className="m-0 text-[13px] text-[#4A5263]">{t("Can’t decide yet")}</p><p className="m-0 mt-0.5 font-serif text-[30px] leading-[1.15]" style={{ color: blocked ? "#B3261E" : "#121826" }}>{blocked}</p><p className="m-0 text-[12px] text-[#4A5263]">{t("fewer than {n} reviews (F2)", { n: min })}</p></div>
        <div className="rounded-[8px] border border-[#DADDE3] bg-[#F7F8F6] px-4 py-3.5"><p className="m-0 text-[13px] text-[#4A5263]">{t("Status")}</p><p className="m-0 mt-1 text-[15px] font-semibold">{t("Drafts — authors see nothing")}</p><p className="m-0 text-[12px] text-[#4A5263]">{t("until you release (F4)")}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setF(k)} aria-pressed={f === k}
            className={`h-8 rounded-full border px-3 text-[13px] ${f === k ? "border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border-[#DADDE3] bg-white text-[#4A5263]"}`}>{l}</button>
        ))}
        <button type="button" onClick={exportCsv} className={`${ui.ghost} ml-auto h-9! text-[13px]!`}>{t("Export CSV")}</button>
        <Link href={`/manage/${slug}/decisions/letters`} className={`${ui.navy} h-9! text-[13px]!`}>{t("Review letters & release")} →</Link>
      </div>
      {err ? <p role="alert" className={`${ui.bad} m-0`}>{err}</p> : null}

      <div className="overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
        <table className={`${ui.table} min-w-[980px]`} aria-busy={pending}>
          <thead><tr>
            {[t("ID"), t("Paper"), t("Scores ({r})", { r: Array.from({ length: cols }, (_, i) => `R${i + 1}`).join(" ") }), t("Avg"), t("Spread"), t("AE recommends"), t("Decision")].map((h) => <th key={h} scope="col" className={ui.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {list.map((r) => {
              const ok = can(r);
              const [rb, ri] = recTone(r.aeRec);
              const locked = r.released && !canChangeReleased;
              return (
                <tr key={r.id} style={{ background: r.decision ? (r.decision === "reject" ? "#FFFAF9" : "#FAFDFB") : undefined }}>
                  <td className={`${ui.td} font-mono text-[13px]`}>{paperId(r.number)}</td>
                  <td className={ui.td}><span className="font-semibold">{r.title}</span><span className="block text-[12px] text-[#4A5263]">{r.topic ?? ""}</span></td>
                  <td className={ui.td}>
                    <span className="flex gap-1">
                      {Array.from({ length: cols }, (_, k) => {
                        const v = r.scores[k];
                        if (v == null) return <span key={k} className="grid h-7 w-8 place-items-center rounded-[4px] bg-[#F5F6F3] font-mono text-[12px] text-[#9AA3B5]">–</span>;
                        const [bg, ink] = scoreTone(v);
                        return <span key={k} className="grid h-7 w-8 place-items-center rounded-[4px] font-mono text-[12px] font-semibold" style={{ background: bg, color: ink }}>{Number.isInteger(v) ? v : v.toFixed(1)}</span>;
                      })}
                    </span>
                  </td>
                  <td className={`${ui.td} font-mono text-[13px] font-semibold`}>{r.avg == null ? "—" : r.avg.toFixed(1)}</td>
                  <td className={`${ui.td} font-mono text-[13px]`} style={{ color: (r.spread ?? 0) >= 2 ? "#B3261E" : "#4A5263" }}>{ok && r.spread != null ? r.spread.toFixed(1) : "—"}</td>
                  <td className={ui.td}><span className={ui.tag} style={{ background: rb, color: ri }}>{r.aeRec ? t(AE_REC_LABEL[r.aeRec] ?? r.aeRec) : t("PENDING")}</span></td>
                  <td className={ui.td}>
                    {r.decision === "desk_reject" ? <span className="text-[13px] text-[#B3261E]">{t("Desk rejected")}</span> : ok ? (
                      <span className="flex flex-wrap items-center gap-1">
                        {DECISIONS.map((d) => {
                          const on = r.decision === d, c = DECISION_COLOR[d];
                          return <button key={d} type="button" disabled={pending || locked} aria-pressed={on} onClick={() => pick(r, d)} className="h-7 rounded-[4px] px-2 text-[12px] font-semibold disabled:cursor-not-allowed"
                            style={{ background: on ? c : "#FFFFFF", color: on ? "#FFFFFF" : "#4A5263", border: `1px solid ${on ? c : "#DADDE3"}` }}>{t(DECISION_SHORT[d])}</button>;
                        })}
                        {r.released ? <span className="ml-1 font-mono text-[10px] uppercase text-[#4A5263]">{t("Released")}</span> : null}
                      </span>
                    ) : (
                      <span className="text-[13px] text-[#A8600F]">{t("Needs {n} reviews (has {m})", { n: min, m: r.reviewsIn })} · <Link href={`/manage/${slug}/reviews`}>{t("chase")}</Link></span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!list.length ? <tr><td colSpan={7} className="px-3.5 py-8 text-center text-[#4A5263]">{t("Nothing in this view.")}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
