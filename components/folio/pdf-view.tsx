"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFWorker } from "pdfjs-dist";

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}

/**
 * The live PDF: every page rendered to a canvas at the panel's width (sharp on high-density screens).
 * A new build is drawn off-screen first and swapped in, keeping the scroll position, so the preview never blinks.
 */
export function PdfView({ url, zoom, onPages }: { url: string | null; zoom: number; onPages?: (n: number) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState(false);
  const live = useRef<HTMLDivElement>(null);
  // One worker for the life of the panel: each new build's document is opened and closed on it,
  // so closing an old build never stops the one being drawn.
  const worker = useRef<PDFWorker | null>(null);
  useEffect(() => () => { worker.current?.destroy(); worker.current = null; }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.floor(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!url || !width || !live.current) return;
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    let task: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        if (!worker.current) worker.current = new pdfjs.PDFWorker();
        const t = pdfjs.getDocument({ url, worker: worker.current });
        task = t;
        doc = await t.promise;
        if (cancelled) return;
        onPages?.(doc.numPages);
        const next = document.createElement("div");
        next.className = "flex flex-col items-center gap-3 py-3";
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const target = Math.max(200, (width - 24) * zoom);
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (target / base.width) * dpr });
          const c = document.createElement("canvas");
          c.width = Math.floor(vp.width);
          c.height = Math.floor(vp.height);
          c.style.width = `${Math.floor(vp.width / dpr)}px`;
          c.style.height = `${Math.floor(vp.height / dpr)}px`;
          c.className = "block bg-white shadow-[0_1px_3px_rgba(14,27,61,0.18)]";
          c.setAttribute("aria-label", `Page ${i}`);
          c.dataset.page = String(i);
          await page.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp }).promise;
          next.appendChild(c);
        }
        if (cancelled || !live.current) return;
        const el = scroller.current!;
        const keep = el.scrollHeight > el.clientHeight ? el.scrollTop / el.scrollHeight : 0;
        live.current.replaceChildren(next);
        el.scrollTop = keep * el.scrollHeight;
        setError(false);
      } catch (e) {
        console.error("[folio] PDF preview failed", e);
        if (!cancelled) setError(true);
      } finally {
        void task?.destroy();
      }
    })();
    return () => { cancelled = true; };
  }, [url, width, zoom, onPages]);

  return (
    <div ref={scroller} className="relative h-full overflow-auto bg-[#E9EBEE]" aria-label="PDF preview">
      {!url ? <p className="m-0 p-6 text-center text-[13px] text-[#4A5263]">The PDF appears here after the first build.</p> : null}
      {error ? <p role="alert" className="m-3 rounded-[4px] bg-[#FDECEA] p-2 text-[13px] text-[#8E1F17]">The PDF could not be shown. Try building again.</p> : null}
      <div ref={live} />
    </div>
  );
}
