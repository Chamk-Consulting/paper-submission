"use client";

import Link from "@/components/site/link";
import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { ui } from "@/components/manage/ui";
import { Act, FieldErr, StateLine, Submit } from "@/components/manage/ops2/act";
import { importSimilarity, markSimilarityChecked, recordSimilarity, saveSimilaritySettings, type OrgState } from "@/lib/manage/orgtools-actions";
import type { SimilarityRow } from "@/lib/manage/orgtools-data";

const no4 = (n: number) => `#${String(n).padStart(4, "0")}`;
type Status = "PENDING" | "CHECKED" | "FLAGGED" | "OK";
const tagCls: Record<Status, string> = {
  PENDING: "bg-[#EEF0EC] text-[#4A5263]", CHECKED: "bg-[#E6EDFC] text-[#1F47A8]", FLAGGED: "bg-[#FDECEA] text-[#B3261E]", OK: "bg-[#E1F3EA] text-[#14603F]",
};

function shown(r: SimilarityRow, ignoreRefs: boolean): number | null {
  if (r.status === "pending") return null;
  return ignoreRefs ? (r.score_excl ?? r.score) : (r.score ?? r.score_excl);
}

function Settings({ slug, threshold, ignoreRefs, canEdit }: { slug: string; threshold: number; ignoreRefs: boolean; canEdit: boolean }) {
  const t = useT();
  const [state, run, pending] = useActionState<OrgState, FormData>(saveSimilaritySettings, {});
  const [custom, setCustom] = useState(![20, 30, 40].includes(threshold));
  const chip = (on: boolean) => `h-[30px] rounded-full border px-3 text-[13px] font-semibold ${on ? "border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border-[#DADDE3] bg-white text-[#4A5263]"}`;
  return (
    <div className={`${ui.card} flex flex-wrap items-center gap-3 px-[18px]! py-3.5!`}>
    <form action={run} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="ignore_refs" value={ignoreRefs ? "true" : "false"} />
      <span className="text-[14px] font-semibold">{t("Flag papers above")}</span>
      <div role="radiogroup" aria-label={t("Threshold")} className="flex flex-wrap items-center gap-1.5">
        {[20, 30, 40].map((n) => (
          <button key={n} type="submit" name="threshold" value={n} role="radio" aria-checked={!custom && threshold === n} disabled={!canEdit || pending}
            onClick={() => setCustom(false)} className={chip(!custom && threshold === n)}>{n}%</button>
        ))}
        {custom ? (
          <span className="flex items-center gap-1.5">
            <label htmlFor="sim-th" className="sr-only">{t("Threshold")}</label>
            <input id="sim-th" name="threshold" type="number" min={1} max={100} defaultValue={threshold} className={`${ui.input} h-[30px]! w-20`} />
            <Submit className={chip(false)}>{t("Set")}</Submit>
          </span>
        ) : canEdit ? <button type="button" onClick={() => setCustom(true)} className={chip(false)}>{t("Other…")}</button> : null}
      </div>
      <FieldErr state={state} name="threshold" />
    </form>
    <form action={run} className="ml-auto">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="threshold" value={threshold} />
      <input type="hidden" name="ignore_refs" value={ignoreRefs ? "false" : "true"} />
      <button type="submit" role="switch" aria-checked={ignoreRefs} disabled={!canEdit || pending}
        className="flex items-center gap-2 border-0 bg-transparent text-[14px] text-[#121826]">
        <span aria-hidden className={`relative inline-block h-5 w-9 rounded-full ${ignoreRefs ? "bg-[#18744F]" : "bg-[#8A93A6]"}`}>
          <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-[left] ${ignoreRefs ? "left-[18px]" : "left-0.5"}`} />
        </span>
        {t("Ignore references and quotes")}
      </button>
    </form>
    <div className="w-full empty:hidden"><StateLine state={state} /></div>
    </div>
  );
}

function RecordForm({ slug, row, onDone }: { slug: string; row: SimilarityRow; onDone: () => void }) {
  const t = useT();
  const [state, run] = useActionState<OrgState, FormData>(async (p, fd) => { const r = await recordSimilarity(p, fd); if (r.ok) onDone(); return r; }, {});
  return (
    <form action={run} className="mt-3 flex flex-col gap-3 border-t border-[#EEF0EC] pt-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="submissionId" value={row.submission_id} />
      <div className="grid grid-cols-2 gap-3">
        <label className={ui.label}>{t("Overlap, whole text (%)")}<input name="score" inputMode="decimal" defaultValue={row.score ?? ""} className={ui.input} /><FieldErr state={state} name="score" /></label>
        <label className={ui.label}>{t("Without references (%)")}<input name="score_excl" inputMode="decimal" defaultValue={row.score_excl ?? ""} className={ui.input} /><FieldErr state={state} name="score_excl" /></label>
      </div>
      <label className={ui.label}>{t("Sources")}<textarea name="sources" rows={3} className={`${ui.textarea} text-[13px]`} placeholder={t("One per line, e.g. Journal article, 2025 — 24%")}
        defaultValue={row.sources.map((x) => `${x.title}${x.pct !== null && x.pct !== undefined ? ` — ${x.pct}%` : ""}`).join("\n")} /></label>
      <label className={ui.label}>{t("Link to the full report")}<input name="report_url" type="url" defaultValue={row.report_url ?? ""} placeholder="https://" className={ui.input} /><FieldErr state={state} name="report_url" /></label>
      <StateLine state={state} />
      <div className="flex gap-2"><Submit className={ui.navy} pendingLabel={t("Saving…")}>{t("Save report")}</Submit><button type="button" onClick={onDone} className={ui.ghost}>{t("Cancel")}</button></div>
    </form>
  );
}

function ImportForm({ slug }: { slug: string }) {
  const t = useT();
  const [state, run] = useActionState<OrgState, FormData>(importSimilarity, {});
  return (
    <form action={run} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <p className={`${ui.hint} m-0`}>{t("Export the results from your similarity service as CSV. Columns: paper number, score, top source.")}</p>
      <input type="file" name="file" accept=".csv,text/csv,text/plain" className="text-[13px]" aria-label={t("CSV file")} />
      <textarea name="csv" rows={3} aria-label={t("Or paste CSV")} className={`${ui.textarea} font-mono text-[12px]`} placeholder={"number,score,source\n745,41,Journal article 2025"} />
      {state.ok ? (
        <p role="status" className="m-0 text-[13px] text-[#14603F]">
          {t("Imported {n} scores.", { n: state.matched ?? 0 })}
          {state.unmatched?.length ? ` ${t("Not found: {list}", { list: state.unmatched.map(no4).join(", ") })}` : ""}
        </p>
      ) : null}
      <StateLine state={state} />
      <Submit className={ui.ghost} pendingLabel={t("Importing…")}>{t("Import CSV")}</Submit>
    </form>
  );
}

export function SimilarityBoard({ slug, rows, threshold, ignoreRefs, canEdit, providerOn }: {
  slug: string; rows: SimilarityRow[]; threshold: number; ignoreRefs: boolean; canEdit: boolean; providerOn: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const view = useMemo(() => rows.map((r) => {
    const v = shown(r, ignoreRefs);
    const st: Status = v === null ? "PENDING" : r.checked_at ? "CHECKED" : v >= threshold ? "FLAGGED" : "OK";
    return { r, v, st };
  }).sort((a, b) => (b.v ?? -1) - (a.v ?? -1)), [rows, ignoreRefs, threshold]);
  const [sel, setSel] = useState<string | null>(view[0]?.r.submission_id ?? null);
  const [editing, setEditing] = useState(false);
  const [running, start] = useTransition();
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const cur = view.find((x) => x.r.submission_id === sel) ?? view[0];
  const checkedCount = view.filter((x) => x.v !== null).length;
  const bar = (v: number | null, st: Status) => (st === "FLAGGED" ? "#B3261E" : v !== null && v >= 15 ? "#A8600F" : "#18744F");

  function runProvider(id: string) {
    setRunMsg(null);
    start(async () => {
      const res = await fetch(`/api/manage/${slug}/similarity/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId: id }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setRunMsg(res.ok ? t("Check finished.") : j.error === "provider_off" ? t("No similarity service is connected.") : t("The check failed. Try again or record the score by hand."));
      if (res.ok) router.refresh();
    });
  }

  if (!rows.length) return <p className={ui.warn}>{t("No submitted papers yet.")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <Settings slug={slug} threshold={threshold} ignoreRefs={ignoreRefs} canEdit={canEdit} />
      <p className="m-0 -mt-2 text-[13px] text-[#4A5263]">
        {providerOn ? t("Provider: connected") : t("Provider: none connected — record scores by hand or import a CSV")} · {t("{n} of {total} checked", { n: checkedCount, total: rows.length })}
      </p>
      <div className="flex flex-wrap items-start gap-5">
        <section className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-[8px] border border-[#DADDE3] bg-white">
          <div className="overflow-x-auto">
            <table className={ui.table}>
              <thead><tr><th scope="col" className={ui.th}>{t("Paper")}</th><th scope="col" className={`${ui.th} w-[220px]`}>{t("Overlap")}</th><th scope="col" className={ui.th}>{t("Largest source")}</th><th scope="col" className={ui.th}>{t("Status")}</th></tr></thead>
              <tbody>
                {view.map(({ r, v, st }) => (
                  <tr key={r.submission_id} className={cur?.r.submission_id === r.submission_id ? "bg-[#FBFCFF]" : ""}>
                    <td className={ui.td}>
                      <button type="button" onClick={() => { setSel(r.submission_id); setEditing(false); }} aria-pressed={cur?.r.submission_id === r.submission_id} className="border-0 bg-transparent p-0 text-left text-[#121826]">
                        <span className="font-mono text-[12px] text-[#4A5263]">{no4(r.number)}</span>
                        <span className="block font-semibold">{r.title}</span>
                      </button>
                    </td>
                    <td className={ui.td}>
                      <div className="flex items-center gap-2">
                        <span aria-hidden className="h-2 flex-auto overflow-hidden rounded bg-[#EEF0EC]"><span className="block h-2" style={{ width: `${v ?? 0}%`, background: bar(v, st) }} /></span>
                        <span className="w-12 text-right font-mono font-semibold">{v === null ? "—" : `${v}%`}</span>
                      </div>
                    </td>
                    <td className={`${ui.td} text-[#4A5263]`}>{r.top_source ?? (v === null ? t("Not checked yet") : "—")}</td>
                    <td className={ui.td}><span className={`${ui.tag} ${tagCls[st]}`}>{t(st)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="flex flex-[1_1_340px] flex-col gap-4">
          {cur ? (
            <section className={ui.card}>
              <p className={ui.kicker}>{no4(cur.r.number)} · {t("report")}</p>
              <h2 className="mt-1.5 text-[18px] font-semibold">{cur.r.title}</h2>
              {cur.v !== null ? (
                <>
                  <p className="m-0 mt-1 font-mono text-[32px] font-semibold" style={{ color: bar(cur.v, cur.st) }}>{cur.v}%</p>
                  <p className="m-0 text-[13px] text-[#4A5263]">{t("overlap with {n} sources", { n: cur.r.sources.length || (cur.r.top_source ? 1 : 0) })}{ignoreRefs ? ` · ${t("references and quotes ignored")}` : ""}</p>
                  {cur.r.sources.length ? (
                    <ol className="m-0 mt-3 pl-[18px] text-[14px] leading-[1.7]">
                      {cur.r.sources.map((x, i) => <li key={i}>{x.url ? <a href={x.url} target="_blank" rel="noreferrer">{x.title}</a> : x.title}{x.pct !== null && x.pct !== undefined ? <> — <strong>{x.pct}%</strong></> : null}</li>)}
                    </ol>
                  ) : cur.r.top_source ? <p className="m-0 mt-3 text-[14px]">{cur.r.top_source}</p> : null}
                  {cur.r.checked_at ? <p className="m-0 mt-3 text-[13px] text-[#14603F]">{t("Checked by {name}", { name: cur.r.checked_by ?? "—" })} · {new Date(cur.r.checked_at).toLocaleDateString(t.intl)}</p> : null}
                </>
              ) : <p className="m-0 mt-2 text-[14px] text-[#4A5263]">{t("No report yet for this paper.")}</p>}
              <div className="mt-3.5 flex flex-wrap gap-2">
                {cur.r.report_url ? <a href={cur.r.report_url} target="_blank" rel="noreferrer" className={`${ui.ghost} h-8! px-3! text-[13px]!`}>{t("Open full report")}</a> : null}
                {cur.v !== null ? (
                  <Act action={markSimilarityChecked} fields={{ slug, submissionId: cur.r.submission_id, checked: cur.r.checked_at ? "false" : "true" }} className={`${ui.ghost} h-8! px-3! text-[13px]!`} pendingLabel={t("Saving…")}>
                    {cur.r.checked_at ? t("Undo checked") : t("Mark as checked")}
                  </Act>
                ) : null}
                <button type="button" onClick={() => setEditing((e) => !e)} className={`${ui.ghost} h-8! px-3! text-[13px]!`}>{cur.v === null ? t("Record a score") : t("Edit score")}</button>
                {providerOn ? <button type="button" disabled={running} onClick={() => runProvider(cur.r.submission_id)} className={`${ui.ghost} h-8! px-3! text-[13px]!`}>{running ? t("Checking…") : t("Run check")}</button> : null}
                <Link href={`/manage/${slug}/papers`} className={`${ui.ghost} h-8! border-[#F3C3BE]! px-3! text-[13px]! text-[#B3261E]!`}>{t("Desk reject…")}</Link>
              </div>
              {runMsg ? <p role="status" className="m-0 mt-2 text-[13px] text-[#4A5263]">{runMsg}</p> : null}
              {editing ? <RecordForm slug={slug} row={cur.r} onDone={() => setEditing(false)} /> : null}
            </section>
          ) : null}
          <section className={`${ui.card} text-[14px]`}>
            <p className={ui.kicker}>{t("Who sees this")}</p>
            <p className="m-0 mt-2 text-[#4A5263]">{t("Chairs and the paper's associate editor. Reviewers see only “checked” — never the score. Authors are told only if the paper is desk-rejected for overlap (rule B4).")}</p>
          </section>
          {canEdit ? (
            <details className={ui.card}>
              <summary className="cursor-pointer text-[15px] font-semibold">{t("Import scores (CSV)")}</summary>
              <div className="mt-3"><ImportForm slug={slug} /></div>
            </details>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
