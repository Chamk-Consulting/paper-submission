"use client";

import Link from "@/components/site/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { deskReject } from "@/lib/manage/ops1-actions";
import { paperId, toCsv, DECISION_LABEL } from "@/lib/manage/ops1-shared";

/* EM21 — papers table with filters, search, CSV export and the desk-reject dialog (D8, D9). */

export type PaperListRow = {
  id: string; number: number | null; title: string; paperType: string; topic: string | null; stage: string; authors: string[]; authorCount: number; countries: string[];
  pdf: string; similarity: number | null; confirmed: number; aeName: string | null; decision: string | null; released: boolean;
};

const REASONS: [string, string][] = [
  ["Similarity", "The paper’s similarity with previously published work is too high to send it for review."],
  ["Out of scope", "The paper is outside the scope of the conference, so it can’t be sent for review."],
  ["Format / page limit", "The paper doesn’t follow the required format or exceeds the page limit."],
  ["Not anonymised", "The paper identifies its authors, which the double-blind review doesn’t allow."],
];

export function PapersTable({ slug, rows, canDesk, initialFilter, label }: { slug: string; rows: PaperListRow[]; canDesk: boolean; initialFilter: string; label: string }) {
  const t = useT();
  const router = useRouter();
  const [f, setF] = useState(initialFilter);
  const [q, setQ] = useState("");
  const [dlg, setDlg] = useState<PaperListRow | null>(null);
  const [reason, setReason] = useState(REASONS[0][0]);
  const [msg, setMsg] = useState(t(REASONS[0][1]));
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const flag = (r: PaperListRow) => (r.similarity ?? 0) >= 30;
  const pdfBad = (r: PaperListRow) => r.pdf === "need";
  const coWait = (r: PaperListRow) => r.confirmed < r.authorCount;
  const counts = { all: rows.length, flag: rows.filter(flag).length, pdf: rows.filter(pdfBad).length, coauth: rows.filter(coWait).length };
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => (f === "all" || (f === "flag" && flag(r)) || (f === "pdf" && pdfBad(r)) || (f === "coauth" && coWait(r)))
      && (!s || paperId(r.number).includes(s.replace(/^#?0*/, "")) || r.title.toLowerCase().includes(s) || r.authors.some((a) => a.toLowerCase().includes(s))));
  }, [rows, f, q]);

  function exportCsv() {
    const csv = toCsv(["ID", "Title", "Type", "Topic", "Stage", "Authors", "Countries", "PDF", "Similarity %", "Co-authors confirmed", "AE", "Decision"],
      list.map((r) => [paperId(r.number), r.title, r.paperType, r.topic, r.stage, r.authors.join("; "), r.countries.join("; "), r.pdf, r.similarity, `${r.confirmed}/${r.authorCount}`, r.aeName, r.decision ? DECISION_LABEL[r.decision] ?? r.decision : ""]));
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${slug}-papers.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  function open(r: PaperListRow) {
    setDlg(r); setErr(null); setReason(REASONS[0][0]); setMsg(t(REASONS[0][1]));
  }
  function confirm() {
    if (!dlg) return;
    start(async () => {
      const res = await deskReject({ slug, submission: dlg.id, reason, message: msg });
      if (res.error) { setErr(t(res.error)); return; }
      setDone(t("{id} desk rejected. Authors notified in Plenary ({n}){mail}.", { id: paperId(dlg.number), n: res.inbox ?? 0, mail: res.skipped ? t(" — email sending isn’t configured, so no email went out") : t(" and by email") }));
      setDlg(null);
      router.refresh();
    });
  }

  const FILTERS: [string, string][] = [["all", t("All {n}", { n: counts.all })], ["flag", t("Similarity flags {n}", { n: counts.flag })], ["pdf", t("PDF failed {n}", { n: counts.pdf })], ["coauth", t("Co-authors waiting {n}", { n: counts.coauth })]];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setF(k)} aria-pressed={f === k}
            className={`h-8 rounded-full border px-3 text-[13px] ${f === k ? "border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border-[#DADDE3] bg-white text-[#4A5263]"}`}>{l}</button>
        ))}
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search ID, title, author")} aria-label={t("Search papers")} className={`${ui.input} ml-auto h-9! w-full text-[14px]! sm:w-[260px]`} />
        <button type="button" onClick={exportCsv} className={`${ui.ghost} h-9! text-[13px]!`}>{t("Export CSV")}</button>
      </div>
      {done ? <p role="status" className={`${ui.ok} m-0`}>{done}</p> : null}
      <div className="overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
        <table className={`${ui.table} min-w-[900px]`}>
          <caption className="sr-only">{t("Papers at {event}", { event: label })}</caption>
          <thead><tr>{["ID", "Paper", "Type · topic", "PDF", "Similar.", "Co-auth.", "Action"].map((h) => <th key={h} scope="col" className={ui.th}>{t(h)}</th>)}</tr></thead>
          <tbody>
            {list.map((r) => {
              const sim = r.similarity ?? 0;
              const rej = r.decision === "desk_reject";
              const decided = !!r.decision || r.stage === "rejected" || r.stage === "withdrawn";
              return (
                <tr key={r.id} style={{ background: rej ? "#FFF8F7" : dlg?.id === r.id ? "#FFFCF5" : undefined }}>
                  <td className={`${ui.td} font-mono text-[13px]`}>{paperId(r.number)}</td>
                  <td className={ui.td}>
                    <span className="font-semibold">{r.title}</span>
                    <span className="block text-[12px] text-[#4A5263]">{t("{n} authors", { n: r.authorCount })}{r.countries.length ? ` · ${r.countries.join(", ")}` : ""}</span>
                  </td>
                  <td className={`${ui.td} text-[13px]`}>{r.paperType}{r.topic ? ` · ${r.topic}` : ""}</td>
                  <td className={ui.td}>
                    <span className={ui.tag} style={r.pdf === "ok" ? { background: "#E1F3EA", color: "#14603F" } : r.pdf === "need" ? { background: "#FDECEA", color: "#B3261E" } : { background: "#EEF0EC", color: "#4A5263" }}>
                      {r.pdf === "ok" ? t("OK") : r.pdf === "need" ? t("FAILED") : t("NOT RUN")}
                    </span>
                  </td>
                  <td className={`${ui.td} font-mono text-[13px]`} style={{ color: sim >= 30 ? "#B3261E" : sim >= 20 ? "#A8600F" : "#4A5263" }}>{r.similarity == null ? "—" : `${Math.round(sim)}%`}</td>
                  <td className={`${ui.td} text-[13px]`} style={{ color: coWait(r) ? "#A8600F" : "#4A5263" }}>{t("{a}/{b} confirmed", { a: r.confirmed, b: r.authorCount })}</td>
                  <td className={`${ui.td} text-[13px]`}>
                    {canDesk && !decided ? (
                      <button type="button" onClick={() => open(r)} className={`h-8 rounded-[4px] border px-3 text-[13px] font-semibold ${sim >= 30 ? "border-[#F3C3BE] bg-[#FDECEA] text-[#8C1D18]" : "border-[#B7BDC9] bg-white text-[#121826]"}`}>{t("Desk reject")}</button>
                    ) : (
                      <span style={{ color: rej ? "#B3261E" : "#4A5263" }}>{rej ? t("Desk rejected") : r.decision ? t(DECISION_LABEL[r.decision] ?? r.decision) : pdfBad(r) ? t("Author told") : r.aeName ? t("AE: {name}", { name: r.aeName }) : t("Submitted")}</span>
                    )}
                    <Link href={`/manage/${slug}/papers/${r.id}/reviewers`} className="ml-2 text-[12px]" aria-label={t("Open {id}", { id: paperId(r.number) })}>→</Link>
                  </td>
                </tr>
              );
            })}
            {!list.length ? <tr><td colSpan={7} className="px-3.5 py-8 text-center text-[#4A5263]">{t("No papers match.")}</td></tr> : null}
          </tbody>
        </table>
      </div>

      {dlg ? (
        <div role="dialog" aria-modal="true" aria-labelledby="desk-title" className="fixed inset-0 z-50 grid place-items-center bg-[rgba(14,27,61,0.45)] p-4" onKeyDown={(e) => e.key === "Escape" && setDlg(null)}>
          <div className="w-full max-w-[560px] rounded-[8px] bg-white p-6 shadow-xl">
            <h2 id="desk-title" className={ui.h2}>{t("Desk reject {id}?", { id: paperId(dlg.number) })}</h2>
            <p className="mt-2 text-[14px] text-[#4A5263]">{t("The paper leaves review. Authors get the reason below (D8). Needs the program chair — you have that role here.")}</p>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t("Reason")}>
              {REASONS.map(([k, text]) => (
                <button key={k} type="button" role="radio" aria-checked={reason === k} onClick={() => { setReason(k); setMsg(t(text)); }}
                  className={`h-8 rounded-full border px-3 text-[13px] ${reason === k ? "border-[#0E1B3D] bg-[#0E1B3D] text-white" : "border-[#DADDE3] bg-white text-[#4A5263]"}`}>{t(k)}</button>
              ))}
            </div>
            <textarea autoFocus aria-label={t("Message to authors")} value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} className={`${ui.textarea} mt-3 w-full`} />
            {err ? <p role="alert" className={`${ui.bad} mt-3`}>{err}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={confirm} className="inline-flex h-11 items-center rounded-[4px] bg-[#B3261E] px-[18px] text-[15px] font-semibold text-white disabled:opacity-60">{pending ? t("Sending…") : t("Desk reject and notify authors")}</button>
              <button type="button" onClick={() => setDlg(null)} className={ui.ghost}>{t("Cancel")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
