"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useT } from "@/lib/i18n/client";
import { addNote, deleteNote, setNoteInReview, type ActionState } from "@/lib/review/actions";
import type { Note } from "@/lib/review/data";
import { Tag } from "@/components/review/parts";
import { ui } from "@/components/manage/ui";

type FileLink = { id: string; role: string; name: string; pages: number | null; size: number; url: string | null };
type Tab = "notes" | "files" | "summary" | "ask";

export type ViewerProps = {
  assignmentId: string; submissionId: string; pdfUrl: string | null; pages: number | null; notes: Note[]; files: FileLink[];
  canEdit: boolean; aiPolicy: string; initialTab?: Tab;
};

const ROLE: Record<string, string> = { paper: "Paper", supplementary: "Supplementary material", video: "Video", other: "Other file" };

/** RV05 blind PDF viewer with private notes, files and (optional) AI help. */
export function PaperViewer(p: ViewerProps) {
  const t = useT();
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>(p.initialTab ?? "notes");
  const [noteState, noteAction, notePending] = useActionState<ActionState, FormData>(addNote, {});
  const [composing, setComposing] = useState(false);
  const [sheet, setSheet] = useState(false); // below xl the side panel is a bottom sheet (M03)
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { if (noteState.ok) formRef.current?.reset(); }, [noteState]);

  const max = p.pages ?? 999;
  const go = (n: number) => setPage(Math.min(max, Math.max(1, n)));
  const src = p.pdfUrl ? `${p.pdfUrl}#page=${page}&toolbar=1&navpanes=0` : null;
  const act = (fn: () => Promise<ActionState>) => start(async () => { setErr(null); const r = await fn(); if (r.error) setErr(r.error); });

  const tabs: [Tab, string][] = [["notes", `${t("Notes")} · ${p.notes.length}`], ["files", t("Files")], ["summary", t("Summary")], ["ask", t("Ask")]];

  return (
    <div className="mt-5 flex flex-col gap-4 xl:flex-row">
      <section className="flex min-w-0 flex-auto flex-col rounded-[8px] border border-[#DADDE3] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#EEF0EC] px-4 py-2.5">
          <button type="button" onClick={() => go(page - 1)} disabled={page <= 1} aria-label={t("Previous page")} className="h-8 rounded-[4px] border border-[#B7BDC9] bg-white px-2.5 disabled:opacity-50">‹</button>
          <label className="flex items-center gap-1.5 text-[13px] text-[#4A5263]">
            {t("Page")}
            <input type="number" min={1} max={max} value={page} onChange={(e) => go(Number(e.target.value) || 1)} className="h-8 w-16 rounded-[4px] border border-[#B7BDC9] px-2 text-[13px]" />
            {p.pages ? <span>/ {p.pages}</span> : null}
          </label>
          <button type="button" onClick={() => go(page + 1)} disabled={page >= max} aria-label={t("Next page")} className="h-8 rounded-[4px] border border-[#B7BDC9] bg-white px-2.5 disabled:opacity-50">›</button>
          {p.canEdit ? (
            <button type="button" onClick={() => { setComposing(true); setTab("notes"); setSheet(true); }} className="ml-auto h-8 rounded-[4px] border-0 bg-[#0E1B3D] px-3 text-[13px] font-semibold text-white">{t("+ Note on this page")}</button>
          ) : null}
        </div>
        {src ? (
          <iframe key={page} src={src} title={t("Paper PDF")} className="h-[78vh] min-h-[520px] w-full border-0 bg-[#EEF0EC]" />
        ) : (
          <p className="m-0 px-5 py-16 text-center text-[14px] text-[#4A5263]">{t("The PDF isn't available. Ask the editor if this persists.")}</p>
        )}
      </section>

      <button type="button" onClick={() => setSheet(true)} aria-expanded={sheet} aria-controls="viewer-panel"
        className={`fixed bottom-4 right-4 z-30 h-12 rounded-full border-0 bg-[#F2A93B] px-[18px] text-[15px] font-bold text-[#0E1B3D] shadow-[0_4px_14px_rgba(18,24,38,.25)] xl:hidden ${sheet ? "hidden" : ""}`}>
        ✎ {t("Notes")} ({p.notes.length}) · ✦ {t("AI")}
      </button>
      <aside id="viewer-panel" aria-label={t("Viewer panels")}
        className={`flex w-full flex-col rounded-[8px] border border-[#DADDE3] bg-white xl:w-[380px] xl:flex-none max-xl:fixed max-xl:inset-x-0 max-xl:bottom-0 max-xl:z-40 max-xl:max-h-[78dvh] max-xl:overflow-y-auto max-xl:rounded-b-none max-xl:rounded-t-[14px] max-xl:shadow-[0_-8px_28px_rgba(18,24,38,0.22)] ${sheet ? "" : "max-xl:hidden"}`}>
        <div className="flex items-center justify-between px-4 pt-2 xl:hidden">
          <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-[#DADDE3]" />
          <button type="button" onClick={() => setSheet(false)} className="h-9 border-0 bg-transparent px-1 text-[14px] text-[#2F5FD0] underline">{t("Close")}</button>
        </div>
        <div role="tablist" aria-label={t("Viewer panels")} className="flex border-b border-[#EEF0EC]">
          {tabs.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`h-11 flex-auto border-0 border-b-2 bg-transparent px-2 text-[13px] font-medium ${tab === k ? "border-[#F2A93B] text-[#121826]" : "border-transparent text-[#4A5263]"}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-col gap-3 p-4">
          {err ? <p role="alert" className="m-0 text-[13px] text-[#B3261E]">{t(err)}</p> : null}

          {tab === "notes" ? (
            <>
              <p className="m-0 text-[13px] text-[#4A5263]">{t("Private notes — only you see them. Send a note to the review to turn it into a comment for the authors.")}</p>
              {composing && p.canEdit ? (
                <form ref={formRef} action={noteAction} className="flex flex-col gap-2 rounded-[6px] border border-[#DADDE3] p-3">
                  <input type="hidden" name="assignment" value={p.assignmentId} />
                  <input type="hidden" name="page" value={page} />
                  <label className="text-[13px] font-medium" htmlFor="note-body">{t("Note on page {n}", { n: page })}</label>
                  <textarea id="note-body" name="body" rows={3} maxLength={4000} required className={ui.textarea} />
                  <div className="flex gap-2">
                    <button type="submit" disabled={notePending} className="h-9 rounded-[4px] border-0 bg-[#F2A93B] px-3 text-[14px] font-semibold text-[#0E1B3D]">{t("Save note")}</button>
                    <button type="button" onClick={() => setComposing(false)} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px]">{t("Cancel")}</button>
                  </div>
                  {noteState.error ? <p role="alert" className="m-0 text-[13px] text-[#B3261E]">{t(noteState.error)}</p> : null}
                </form>
              ) : null}
              {p.notes.length === 0 ? <p className="m-0 text-[14px] text-[#4A5263]">{t("No notes yet.")}</p> : null}
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {p.notes.map((n) => (
                  <li key={n.id} className={`rounded-[6px] border px-3 py-2.5 ${n.in_review ? "border-[#C9D6F5] bg-[#FBFCFF]" : "border-[#DADDE3]"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" onClick={() => n.page && go(n.page)} className="border-0 bg-transparent p-0 font-mono text-[12px] text-[#2F5FD0]">
                        {n.page ? t("p. {n}", { n: n.page }) : t("General")}{n.anchor ? ` · ${n.anchor}` : ""}
                      </button>
                      <Tag tone={n.in_review ? "b" : "n"}>{n.in_review ? t("IN REVIEW") : t("PRIVATE")}</Tag>
                    </div>
                    <p className="mb-0 mt-1 whitespace-pre-line text-[14px]">{n.body}</p>
                    {p.canEdit ? (
                      <div className="mt-2 flex gap-3 text-[13px]">
                        <button type="button" disabled={busy} onClick={() => act(() => setNoteInReview(p.assignmentId, n.id, !n.in_review))} className="border-0 bg-transparent p-0 font-medium text-[#2F5FD0]">
                          {n.in_review ? t("Remove from review") : t("Send to review →")}
                        </button>
                        <button type="button" disabled={busy} onClick={() => act(() => deleteNote(p.assignmentId, n.id))} className="border-0 bg-transparent p-0 text-[#B3261E]">{t("Delete")}</button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {tab === "files" ? (
            <>
              <p className="m-0 text-[13px] text-[#4A5263]">{t("File names and metadata are cleaned before you see them. If you spot author names inside a file, tell the editor.")}</p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {p.files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 rounded-[6px] border border-[#DADDE3] px-3 py-2.5 text-[14px]">
                    <span>
                      <span className="block font-medium">{t(ROLE[f.role] ?? "Other file")}</span>
                      <span className="block text-[12px] text-[#4A5263]">{f.name}{f.pages ? ` · ${t("{n} pages", { n: f.pages })}` : ""} · {(f.size / 1048576).toFixed(1)} MB</span>
                    </span>
                    {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="text-[13px] text-[#2F5FD0]">{t("Open")}</a> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {tab === "summary" ? <AiPanel kind="summary" submissionId={p.submissionId} assignmentId={p.assignmentId} policy={p.aiPolicy} /> : null}
          {tab === "ask" ? <AiPanel kind="ask" submissionId={p.submissionId} assignmentId={p.assignmentId} policy={p.aiPolicy} /> : null}
        </div>
      </aside>
    </div>
  );
}

/** Calls the shared /api/ai route (owned by the author screens). 404/503 → not configured. */
function AiPanel({ kind, submissionId, assignmentId, policy }: { kind: "summary" | "ask"; submissionId: string; assignmentId: string; policy: string }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [out, setOut] = useState<{ state: "idle" | "busy" | "done" | "off" | "error" | "limit"; text?: string }>({ state: "idle" });
  const intro = kind === "summary"
    ? t("AI summary — for orientation only. Your review must be your own reading. Nothing you see here leaves Plenary.")
    : t("Answers cite the page they come from. Check them yourself before using them in your review.");
  if (policy === "not_allowed") return <p className="m-0 text-[14px] text-[#4A5263]">{t("This venue doesn't allow AI tools on papers under review.")}</p>;

  async function run() {
    setOut({ state: "busy" });
    try {
      const res = await fetch("/api/ai", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: kind === "summary" ? "review_summary" : "review_ask", submissionId, assignmentId, question: kind === "ask" ? q : undefined }),
      });
      if (res.status === 404 || res.status === 503 || res.status === 501) { setOut({ state: "off" }); return; }
      if (res.status === 429) { setOut({ state: "limit" }); return; }
      if (!res.ok) { setOut({ state: "error" }); return; }
      const j = (await res.json().catch(() => ({}))) as { text?: string; answer?: string; summary?: string };
      setOut({ state: "done", text: j.text ?? j.answer ?? j.summary ?? "" });
    } catch {
      setOut({ state: "error" });
    }
  }

  return (
    <>
      <p className="m-0 text-[13px] text-[#4A5263]">{intro}</p>
      {kind === "ask" ? (
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          {t("Your question")}
          <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3} maxLength={500} placeholder={t("e.g. Which baseline do they compare against?")} className={ui.textarea} />
        </label>
      ) : null}
      <div>
        <button type="button" onClick={run} disabled={out.state === "busy" || (kind === "ask" && !q.trim())}
          className="h-9 rounded-[4px] border-0 bg-[#0E1B3D] px-3 text-[14px] font-semibold text-white disabled:opacity-60">
          {out.state === "busy" ? t("Working…") : kind === "summary" ? t("Summarise the paper") : t("Ask")}
        </button>
      </div>
      {out.state === "off" ? <p className="m-0 rounded-[6px] bg-[#F7F8F6] px-3 py-2 text-[13px] text-[#4A5263]">{t("AI isn't configured on this server yet.")}</p> : null}
      {out.state === "limit" ? <p className="m-0 text-[13px] text-[#A8600F]">{t("You've reached today's AI limit for this paper.")}</p> : null}
      {out.state === "error" ? <p role="alert" className="m-0 text-[13px] text-[#B3261E]">{t("Something went wrong. Please try again.")}</p> : null}
      {out.state === "done" ? <div className="whitespace-pre-line rounded-[6px] border border-[#DADDE3] px-3 py-2.5 text-[14px] leading-[1.55]">{out.text || t("No answer.")}</div> : null}
    </>
  );
}
