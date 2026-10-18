"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { ViewerFile } from "@/components/submission/followup/open-viewer";

/* SB05v side panel: Checks · Summary (SB05v) · Translate (SB05t) · Ask (SB05a). Talks to /api/ai. */

export type AiTab = "checks" | "summary" | "translate" | "ask";
type SumItem = { key: string; text: string; page: number | null };

const TABS: [AiTab, string][] = [["checks", "Checks"], ["summary", "Summary"], ["translate", "Translate"], ["ask", "Ask"]];
const MODES: ["brief" | "detailed" | "reviewers", string, string][] = [
  ["brief", "Brief", "In one paragraph"],
  ["detailed", "Detailed", "Section by section"],
  ["reviewers", "For reviewers", "Strengths, limits, questions"],
];
const LANGS: [string, string][] = [["fr", "Français"], ["ar", "العربية"], ["es", "Español"], ["pt", "Português"], ["de", "Deutsch"], ["zh", "中文"]];
const SCOPES: ["abstract" | "page" | "summary", string][] = [["abstract", "Abstract"], ["page", "This page"], ["summary", "Summary"]];
const SUGGESTIONS = [
  "What is the main contribution?",
  "Which experiments support the results?",
  "What are the limitations?",
];
const ERRORS: Record<string, string> = {
  ai_off: "AI isn't switched on for this site yet.",
  limit: "AI limit reached — try again in an hour.",
  forbidden: "AI tools aren't available for this paper.",
  sign_in: "Sign in again to use AI tools.",
  unreadable: "We couldn't read the text of this PDF.",
  upstream: "The AI service didn't answer. Try again.",
  summaryFirst: "Make a summary first.",
};

const pageOf = (s: string) => { const m = s.match(/\bpage\s+(\d{1,4})\b/i); return m ? Number(m[1]) : null; };

export function AiPanel({ submissionId, file, page, pages, onGo, initialTab = "checks" }: { submissionId: string; file: ViewerFile; page: number; pages: number; onGo: (n: number) => void; initialTab?: AiTab }) {
  const t = useT();
  const [tab, setTab] = useState<AiTab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<(typeof MODES)[number][0]>("brief");
  const [summary, setSummary] = useState<Partial<Record<string, SumItem[]>>>({});
  const [copied, setCopied] = useState(false);
  const [lang, setLang] = useState("fr");
  const [scope, setScope] = useState<(typeof SCOPES)[number][0]>("abstract");
  const [translation, setTranslation] = useState<{ key: string; text: string } | null>(null);
  const [qa, setQa] = useState<{ q: string; a: string; pages: number[] }[]>([]);
  const [q, setQ] = useState("");

  async function call(payload: Record<string, unknown>) {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId, fileId: file.id, ...payload }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(ERRORS[data.error as string] ?? ERRORS.upstream); return null; }
      return data as Record<string, unknown>;
    } catch {
      setError(ERRORS.upstream);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function summarise(m = mode, force = false) {
    setMode(m);
    if (summary[m] && !force) return;
    const d = await call({ kind: "summary", mode: m });
    if (d) setSummary((s) => ({ ...s, [m]: d.items as SumItem[] }));
  }
  const sumText = (summary[mode] ?? []).map((i) => `${i.key}: ${i.text}`).join("\n");

  async function translate(sc = scope, lg = lang) {
    setScope(sc); setLang(lg);
    if (sc === "summary" && !sumText) { setError(ERRORS.summaryFirst); return; }
    const d = await call({ kind: "translate", lang: lg, scope: sc, page, summary: sc === "summary" ? sumText : undefined });
    if (d) setTranslation({ key: `${lg}:${sc}:${page}`, text: String(d.text ?? "") });
  }

  async function ask(question: string) {
    const qq = question.trim();
    if (qq.length < 2) return;
    setQ("");
    const d = await call({ kind: "ask", question: qq, history: qa.slice(-3).map((x) => ({ q: x.q, a: x.a })) });
    if (d) setQa((list) => [...list, { q: qq, a: String(d.answer ?? ""), pages: (d.pages as number[]) ?? [] }]);
  }

  const pageBtn = (n: number) => <button key={n} type="button" onClick={() => onGo(n)} className="ml-1 rounded-[3px] bg-[#E6EDFC] px-1.5 font-mono text-[12px] text-[#1F47A8] hover:bg-[#D6E1FA]">p.{n}</button>;
  const items = file.check.items ?? [];
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-[13px] ${on ? "border-[#0E1B3D] bg-[#0E1B3D] text-[#F5F6F3]" : "border-[#DADDE3] bg-white text-[#4A5263] hover:border-[#B7BDC9]"}`;

  return (
    <div className="flex min-h-0 w-full flex-col bg-white">
      <div role="tablist" aria-label={t("Tools")} className="flex flex-none border-b border-[#DADDE3]">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setError(null); if (k === "summary") void summarise(); }}
            className={`flex-auto border-b-2 py-3 text-[14px] font-medium ${tab === k ? "border-[#0E1B3D] text-[#121826]" : "border-transparent text-[#4A5263] hover:text-[#121826]"}`}>{t(label)}</button>
        ))}
      </div>

      <div className="min-h-0 flex-auto overflow-y-auto p-4 text-[14px]">
        {tab === "checks" ? (
          <>
            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{t("Version {n}", { n: file.version })} · {file.check.status ? t(file.check.status === "passed" ? "Passed" : file.check.status === "failed" ? "Problems to fix" : "Warnings") : t("Not checked")}</p>
            {items.length ? (
              <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
                {items.map((it) => {
                  const p = pageOf(it.detail);
                  const ink = it.level === "fail" ? "#B3261E" : it.level === "warn" ? "#7A4508" : "#14603F";
                  return (
                    <li key={it.key} className="rounded-[6px] border border-[#EEF0EC] px-3 py-2">
                      <span className="block font-semibold" style={{ color: ink }}>{it.level === "ok" ? "✓" : it.level === "warn" ? "!" : "×"} {t(it.label)}</span>
                      <span className="block text-[#4A5263]">{t(it.detail)}{p ? pageBtn(p) : null}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mt-3 text-[#4A5263]">{t("No checks for this file.")}</p>}
          </>
        ) : null}

        {tab === "summary" ? (
          <>
            <div className="flex flex-wrap gap-1.5">{MODES.map(([k, label, hint]) => <button key={k} type="button" title={t(hint)} aria-pressed={mode === k} onClick={() => summarise(k)} className={chip(mode === k)}>{t(label)}</button>)}</div>
            <p className="mt-2 text-[13px] text-[#4A5263]">{t(MODES.find((m) => m[0] === mode)![2])}</p>
            {busy && !summary[mode] ? <div role="status" className="mt-3 flex flex-col gap-2">{[90, 75, 85].map((w) => <span key={w} className="sk block h-3" style={{ width: `${w}%` }} />)}<span className="sr-only">{t("Working…")}</span></div> : null}
            {summary[mode] ? (
              <>
                <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
                  {summary[mode]!.map((i, n) => <li key={n}><span className="font-semibold">{i.key}</span> — {i.text}{i.page ? pageBtn(i.page) : null}</li>)}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(sumText); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ } }} className="h-8 rounded-[4px] border border-[#B7BDC9] bg-white px-2.5 text-[13px]">{copied ? t("Copied") : t("Copy")}</button>
                  <button type="button" disabled={busy} onClick={() => summarise(mode, true)} className="h-8 rounded-[4px] border border-[#B7BDC9] bg-white px-2.5 text-[13px]">{t("Regenerate")}</button>
                  <button type="button" onClick={() => { setTab("translate"); void translate("summary"); }} className="h-8 rounded-[4px] border border-[#B7BDC9] bg-white px-2.5 text-[13px]">{t("Translate summary")}</button>
                </div>
              </>
            ) : null}
          </>
        ) : null}

        {tab === "translate" ? (
          <>
            <label htmlFor="ai-lang" className="block font-semibold">{t("Translate into")}</label>
            <select id="ai-lang" value={lang} onChange={(e) => setLang(e.target.value)} className="mt-1.5 h-10 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-2.5">
              {LANGS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <div className="mt-3 flex flex-wrap gap-1.5">{SCOPES.map(([k, label]) => <button key={k} type="button" aria-pressed={scope === k} onClick={() => setScope(k)} className={chip(scope === k)}>{k === "page" ? t("Page {n}", { n: page }) : t(label)}</button>)}</div>
            <button type="button" disabled={busy} onClick={() => translate()} className="mt-3 h-10 rounded-[4px] bg-[#0E1B3D] px-4 text-[14px] font-semibold text-white disabled:opacity-60">{busy ? t("Translating…") : t("Translate")}</button>
            <p className="mt-2 text-[12px] text-[#4A5263]">{t("Machine translation for reading only — the English PDF is the version of record.")}</p>
            {translation ? <div dir={translation.key.startsWith("ar:") ? "rtl" : "ltr"} lang={translation.key.split(":")[0]} className="mt-3 whitespace-pre-line rounded-[6px] bg-[#F7F8F6] p-3 leading-[1.6]">{translation.text}</div> : null}
          </>
        ) : null}

        {tab === "ask" ? (
          <>
            {qa.length === 0 ? (
              <>
                <p className="m-0 text-[#4A5263]">{t("Ask a question about this paper. Answers point to the pages they come from.")}</p>
                <div className="mt-3 flex flex-col items-start gap-1.5">{SUGGESTIONS.map((s) => <button key={s} type="button" disabled={busy} onClick={() => ask(t(s))} className="rounded-full border border-[#DADDE3] bg-white px-3 py-1 text-left text-[13px] hover:border-[#B7BDC9]">{t(s)}</button>)}</div>
              </>
            ) : (
              <ol className="m-0 flex list-none flex-col gap-3 p-0">
                {qa.map((x, i) => (
                  <li key={i}>
                    <p className="m-0 ml-8 rounded-[8px] bg-[#0E1B3D] px-3 py-2 text-[#F5F6F3]">{x.q}</p>
                    <p className="m-0 mr-8 mt-1.5 rounded-[8px] bg-[#F7F8F6] px-3 py-2">{x.a}{x.pages.map(pageBtn)}</p>
                  </li>
                ))}
              </ol>
            )}
            {busy ? <p role="status" className="mt-3 text-[#4A5263]">{t("Working…")}</p> : null}
          </>
        ) : null}

        {error ? <p role="alert" className="mt-3 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[#5C1A15]">{t(error)}</p> : null}
      </div>

      {tab === "ask" ? (
        <form className="flex flex-none gap-2 border-t border-[#DADDE3] p-3" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
          <label htmlFor="ai-q" className="sr-only">{t("Ask about this paper")}</label>
          <input id="ai-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={1000} placeholder={t("Ask about this paper…")} className="h-10 min-w-0 flex-auto rounded-[4px] border border-[#B7BDC9] px-2.5" />
          <button type="submit" disabled={busy || q.trim().length < 2} className="h-10 rounded-[4px] bg-[#0E1B3D] px-3.5 font-semibold text-white disabled:opacity-60">{t("Ask")}</button>
        </form>
      ) : null}
      <p className="m-0 flex-none border-t border-[#EEF0EC] px-4 py-2 text-[12px] text-[#4A5263]">✦ {t("AI drafts — check against the paper. Your paper is never used to train models.")}</p>
      <span className="sr-only">{t("{n} pages", { n: pages })}</span>
    </div>
  );
}
