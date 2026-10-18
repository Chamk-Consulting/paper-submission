"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { fileUrl } from "@/lib/submission/actions";
import { useT } from "@/lib/i18n/client";
import { ViewerSkeleton } from "@/components/skeletons/author";
import { AiPanel, type AiTab } from "@/components/submission/followup/ai-panel";
import type { ViewerFile } from "@/components/submission/followup/open-viewer";

/* SB05v — in-app viewer. Pages are drawn client-side with pdf.js from a short-lived signed URL. */

const ext = (n: string) => (n.split(".").pop() ?? "").toUpperCase().slice(0, 4);
const ZOOMS = [50, 67, 80, 100, 125, 150, 200];

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}

function Thumb({ doc, n, on, onClick, label }: { doc: PDFDocumentProxy; n: number; on: boolean; onClick: () => void; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let task: RenderTask | null = null, dead = false;
    doc.getPage(n).then((page) => {
      if (dead || !ref.current) return;
      const vp = page.getViewport({ scale: 96 / page.getViewport({ scale: 1 }).width });
      const c = ref.current;
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      task = page.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp });
      task.promise.catch(() => {});
    }).catch(() => {});
    return () => { dead = true; task?.cancel(); };
  }, [doc, n]);
  return (
    <li>
      <button type="button" onClick={onClick} aria-label={label} aria-current={on ? "page" : undefined} className={`block w-full rounded-[3px] border-2 bg-white p-0 ${on ? "border-[#F2A93B]" : "border-transparent hover:border-[#B7BDC9]"}`}>
        <canvas ref={ref} className="block w-full" />
      </button>
      <span className="mt-0.5 block text-center font-mono text-[11px] text-[#4A5263]">{n}</span>
    </li>
  );
}

export function Viewer(props: { submissionId: string; files: ViewerFile[]; initialTab?: AiTab; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [panel, setPanel] = useState(true);
  // keyed by file: switching files starts from a clean state (page 1, new signed URL)
  return <Pane key={props.files[idx].id} {...props} idx={idx} setIdx={setIdx} panel={panel} setPanel={setPanel} />;
}

function Pane({ submissionId, files, initialTab, onClose, idx, setIdx, panel, setPanel }: {
  submissionId: string; files: ViewerFile[]; initialTab?: AiTab; onClose: () => void; idx: number; setIdx: (i: number) => void; panel: boolean; setPanel: (f: (p: boolean) => boolean) => void;
}) {
  const t = useT();
  const file = files[idx];
  const isPdf = file.mime === "application/pdf";
  const [url, setUrl] = useState<string | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const pages = doc?.numPages ?? file.pages ?? 1;

  // signed URL + document for the selected file
  useEffect(() => {
    let dead = false;
    let loaded: PDFDocumentProxy | null = null;
    (async () => {
      const r = await fileUrl(file.path);
      if (dead) return;
      if (!r.url) { setErr(t("Couldn't open the file.")); return; }
      setUrl(r.url);
      if (!isPdf) return;
      try {
        const pdfjs = await loadPdfjs();
        loaded = await pdfjs.getDocument({ url: r.url }).promise;
        if (dead) { void loaded.loadingTask.destroy(); return; }
        setDoc(loaded);
      } catch {
        if (!dead) setErr(t("This PDF couldn't be displayed. Download it instead."));
      }
    })();
    return () => { dead = true; void loaded?.loadingTask.destroy(); };
  }, [file.path, isPdf, t]);

  // draw the current page
  useEffect(() => {
    if (!doc || !canvas.current) return;
    let task: RenderTask | null = null, dead = false;
    doc.getPage(Math.min(page, doc.numPages)).then((p) => {
      if (dead || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      const fit = Math.min(1.6, ((stage.current?.clientWidth ?? 800) - 48) / base.width);
      const scale = fit * (zoom / 100);
      const ratio = window.devicePixelRatio || 1;
      const vp = p.getViewport({ scale: scale * ratio });
      const c = canvas.current;
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      c.style.width = `${Math.floor(vp.width / ratio)}px`; c.style.height = `${Math.floor(vp.height / ratio)}px`;
      task = p.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp });
      task.promise.catch(() => {});
    }).catch(() => {});
    return () => { dead = true; task?.cancel(); };
  }, [doc, page, zoom]);

  const go = useCallback((n: number) => setPage(Math.max(1, Math.min(pages, n))), [pages]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const typing = (e.target as HTMLElement)?.closest?.("input, textarea, select");
      if (typing) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") setPage((p) => Math.min(pages, p + 1));
      if (e.key === "ArrowLeft" || e.key === "PageUp") setPage((p) => Math.max(1, p - 1));
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, [onClose, pages]);

  const zi = ZOOMS.indexOf(zoom);
  const barBtn = "flex size-9 items-center justify-center rounded-[4px] text-[18px] text-[#F5F6F3] hover:bg-white/10 disabled:opacity-40";
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0E1B3D]/70 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t("Document viewer")} className="flex min-h-0 flex-auto flex-col overflow-hidden bg-white outline-none sm:rounded-[8px]">
        {/* top bar */}
        <div className="flex flex-none flex-wrap items-center gap-2 bg-[#0E1B3D] px-3 py-2 text-[#F5F6F3]">
          <div role="tablist" aria-label={t("Files")} className="flex min-w-0 flex-auto gap-1 overflow-x-auto">
            {files.map((f, i) => (
              <button key={f.id} type="button" role="tab" aria-selected={i === idx} onClick={() => setIdx(i)} className={`flex h-9 max-w-[260px] flex-none items-center gap-2 rounded-[4px] px-2.5 text-[14px] ${i === idx ? "bg-white/15" : "hover:bg-white/10"}`}>
                <span className="rounded-[3px] bg-[#F2A93B] px-1 font-mono text-[10px] font-semibold text-[#0E1B3D]">{ext(f.name)}</span><span className="truncate">{f.name}</span>
              </button>
            ))}
          </div>
          {isPdf ? (
            <div className="flex items-center gap-1">
              <button type="button" className={barBtn} onClick={() => go(page - 1)} disabled={page <= 1} aria-label={t("Previous page")}>‹</button>
              <span className="whitespace-nowrap px-1 font-mono text-[13px]">{t("Page {n} of {total}", { n: page, total: pages })}</span>
              <button type="button" className={barBtn} onClick={() => go(page + 1)} disabled={page >= pages} aria-label={t("Next page")}>›</button>
              <span className="mx-1 h-5 w-px bg-white/20" />
              <button type="button" className={barBtn} onClick={() => setZoom(ZOOMS[Math.max(0, zi - 1)])} disabled={zi <= 0} aria-label={t("Zoom out")}>−</button>
              <span className="w-12 text-center font-mono text-[13px]">{zoom}%</span>
              <button type="button" className={barBtn} onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zi + 1)])} disabled={zi >= ZOOMS.length - 1} aria-label={t("Zoom in")}>+</button>
            </div>
          ) : null}
          <div className="flex items-center gap-1">
            {isPdf ? <button type="button" onClick={() => setPanel((p) => !p)} aria-pressed={panel} className="hidden h-9 rounded-[4px] px-2.5 text-[14px] hover:bg-white/10 md:block">✦ {t("AI tools")}</button> : null}
            {url ? <a href={url} download={file.name} className="h-9 rounded-[4px] px-2.5 text-[14px] leading-9 text-[#F5F6F3] no-underline hover:bg-white/10">{t("Download")}</a> : null}
            <button type="button" onClick={onClose} className={barBtn} aria-label={t("Close viewer (Esc)")}>×</button>
          </div>
        </div>

        <div className="flex min-h-0 flex-auto">
          {isPdf && doc ? (
            <ol className="m-0 hidden w-[120px] flex-none list-none flex-col gap-3 overflow-y-auto border-r border-[#DADDE3] bg-[#F5F6F3] p-3 md:flex">
              {Array.from({ length: Math.min(doc.numPages, 60) }, (_, i) => <Thumb key={i} doc={doc} n={i + 1} on={page === i + 1} onClick={() => go(i + 1)} label={t("Go to page {n}", { n: i + 1 })} />)}
            </ol>
          ) : null}
          <div ref={stage} className="flex min-w-0 flex-auto justify-center overflow-auto bg-[#E9EBE6] p-6">
            {err ? (
              <p role="alert" className="self-start rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-4 py-3 text-[15px] text-[#5C1A15]">{err}</p>
            ) : !isPdf ? (
              <div className="self-start rounded-[8px] border border-[#DADDE3] bg-white px-6 py-8 text-center">
                <p className="m-0 font-semibold">{file.name}</p>
                <p className="mt-1 text-[14px] text-[#4A5263]">{t("No preview for this file type.")}</p>
                {url ? <a href={url} download={file.name} className="mt-3 inline-flex h-10 items-center rounded-[4px] bg-[#0E1B3D] px-4 text-[15px] font-semibold text-white no-underline">{t("Download")}</a> : null}
              </div>
            ) : !doc ? (
              <div className="w-full"><ViewerSkeleton /></div>
            ) : (
              <canvas ref={canvas} aria-label={t("Page {n} of {total}", { n: page, total: pages })} className="h-fit bg-white shadow-[0_1px_4px_rgba(18,24,38,0.18)]" />
            )}
          </div>
          {isPdf && panel ? (
            <div className="hidden w-[380px] flex-none border-l border-[#DADDE3] md:flex">
              <AiPanel submissionId={submissionId} file={file} page={page} pages={pages} onGo={go} initialTab={initialTab} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
