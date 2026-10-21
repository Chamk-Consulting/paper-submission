"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/browser";
import { finishFollowupUpload } from "@/lib/submission/followup-actions";
import type { SubFile } from "@/lib/submission/data";
import { useT } from "@/lib/i18n/client";

export function PrintButton({ label, className }: { label: string; className?: string }) {
  return <button type="button" onClick={() => window.print()} className={className ?? "h-10 rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[14px]"}>{label}</button>;
}

type I18n = { key: string; vars?: Record<string, string | number> };
type Item = NonNullable<SubFile["check"]["items"]>[number] & { i18n?: I18n; valueI18n?: I18n };
const ICON = { ok: ["✓", "#E1F3EA", "#14603F"], warn: ["!", "#FBEFDD", "#7A4508"], fail: ["×", "#FDECEA", "#B3261E"] } as const;
const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;

export function FieldError({ msg }: { msg?: string }) {
  const t = useT();
  return msg ? <p role="alert" className="mt-1.5 text-[14px] text-[#B3261E]">{t(msg)}</p> : null;
}

export function ErrorBox({ msg }: { msg?: string }) {
  const t = useT();
  return msg ? <p role="alert" className="mt-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{t(msg)}</p> : null;
}

export function Saved({ at }: { at?: string }) {
  const t = useT();
  return at ? <span role="status" className="text-[14px] text-[#14603F]">✓ {t("Saved")}</span> : null;
}

/** The PDF check result list (same look as SB04). */
export function CheckList({ file }: { file: SubFile }) {
  const t = useT();
  const items = (file.check.items ?? []) as Item[];
  if (!items.length) return null;
  return (
    <ul className="m-0 mt-4 list-none border-t border-[#EEF0EC] p-0">
      {items.map((it) => {
        const [g, bg, ink] = ICON[it.level];
        return (
          <li key={it.key} className="flex gap-3 border-b border-[#EEF0EC] py-3">
            <span aria-hidden className="flex size-[22px] flex-none items-center justify-center rounded-full text-[12px] font-bold" style={{ background: bg, color: ink }}>{g}</span>
            <span><span className="font-semibold">{t(it.label)}</span> · {it.valueI18n ? t(it.valueI18n.key, it.valueI18n.vars) : t(it.value)}<span className="block text-[14px]" style={{ color: it.level === "ok" ? "#4A5263" : ink }}>{it.i18n ? t(it.i18n.key, it.i18n.vars) : t(it.detail)}</span></span>
          </li>
        );
      })}
    </ul>
  );
}


type Role = "revision" | "highlighted" | "final" | "slides" | "supplementary";

/** Upload one follow-up file (final PDF, revised paper, highlighted copy, supplementary ZIP). */
export function FollowupUpload({ id, role, current, accept = "application/pdf,.pdf", maxMb = 20, label, hint, children }: {
  id: string; role: Role; current?: SubFile; accept?: string; maxMb?: number; label: string; hint?: string; children?: ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "uploading" | "checking">(null);
  const [error, setError] = useState<string | null>(null);
  const pdfOnly = accept.includes("pdf") && !accept.includes("zip");

  async function upload(file: File) {
    setError(null);
    if (pdfOnly && !/\.pdf$/i.test(file.name)) { setError(t("The file must be a PDF.")); return; }
    if (file.size > maxMb * 1048576) { setError(t("That file is {size} — the limit is {max} MB.", { size: mb(file.size), max: maxMb })); return; }
    const mime = /\.pdf$/i.test(file.name) ? "application/pdf" : /\.zip$/i.test(file.name) ? "application/zip" : file.type || "application/octet-stream";
    setBusy("uploading");
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().slice(0, 4);
    const path = `${id}/${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await createClient().storage.from("papers").upload(path, file, { contentType: mime, upsert: false });
    if (upErr) { setBusy(null); setError(/row-level|policy|403/i.test(upErr.message) ? t("You can't upload files to this paper now.") : t("Upload failed: {msg}", { msg: upErr.message })); return; }
    setBusy("checking");
    const r = await finishFollowupUpload({ submissionId: id, role, path, name: file.name, size: file.size, mime });
    setBusy(null);
    if (r.error) { setError(t(r.error)); return; }
    router.refresh();
  }

  return (
    <div>
      <input ref={input} type="file" accept={accept} className="sr-only" aria-label={label} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
      {busy ? (
        <div role="status" className="flex items-center gap-3 rounded-[8px] border border-[#DADDE3] bg-[#FBFBF9] px-4 py-5">
          <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-[#B7BDC9] border-t-[#0E1B3D]" />
          <span>{busy === "uploading" ? t("Uploading…") : t("Checking page size, length, fonts and margins…")}</span>
        </div>
      ) : current ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[#DADDE3] bg-[#FBFBF9] px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">{current.name}</div>
            <div className="font-mono text-[13px] text-[#4A5263]">v{current.version} · {mb(current.size)}{current.pages != null ? ` · ${t("{n} pages", { n: current.pages })}` : ""}</div>
          </div>
          <div className="flex gap-2">{children}<button type="button" onClick={() => input.current?.click()} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px]">{t("Replace")}</button></div>
        </div>
      ) : (
        <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
          className="flex flex-col items-center rounded-[8px] border-2 border-dashed border-[#B7BDC9] bg-[#FBFBF9] px-6 py-8 text-center">
          <div className="text-[16px] font-semibold">{label}</div>
          {hint ? <p className="mt-1 text-[14px] text-[#4A5263]">{hint}</p> : null}
          <button type="button" onClick={() => input.current?.click()} className="mt-3 h-10 rounded-[4px] bg-[#0E1B3D] px-4 text-[15px] font-semibold text-white">{t("Choose file…")}</button>
        </div>
      )}
      {error ? <p role="alert" className="mt-3 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{error}</p> : null}
    </div>
  );
}
