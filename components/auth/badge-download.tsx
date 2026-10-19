"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

/* PR09 "Save badge": PNG drawn in the browser from an SVG (no upload), PDF from /api/badge. */

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function badgeSvg(p: { name: string; affiliation: string; id: string; orcid: string | null; qrSvg: string }) {
  const qr = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(p.qrSvg)))}`;
  const name = p.name.length > 34 ? `${p.name.slice(0, 33)}…` : p.name;
  const aff = p.affiliation.length > 48 ? `${p.affiliation.slice(0, 47)}…` : p.affiliation;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="600" viewBox="0 0 1050 600">
<rect width="1050" height="600" rx="28" fill="#FFFFFF"/><rect width="1050" height="600" rx="28" fill="none" stroke="#DADDE3" stroke-width="3"/>
<path d="M28 0h994a28 28 0 0 1 28 28v14H0V28A28 28 0 0 1 28 0z" fill="#0E1B3D"/>
<g transform="translate(64 96)"><circle cx="22" cy="22" r="19" fill="none" stroke="#121826" stroke-width="3"/><path d="M8 22h28M22 4v36" stroke="#121826" stroke-width="3"/><circle cx="22" cy="22" r="5" fill="#F2A93B"/>
<text x="58" y="34" font-family="Georgia, 'Times New Roman', serif" font-size="38" fill="#121826">Plenary</text></g>
<text x="64" y="236" font-family="Georgia, 'Times New Roman', serif" font-size="56" fill="#121826">${esc(name)}</text>
<text x="64" y="284" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#4A5263">${esc(aff)}</text>
<text x="64" y="380" font-family="'Courier New', monospace" font-size="22" letter-spacing="3" fill="#4A5263">PLENARY ID</text>
<text x="64" y="436" font-family="'Courier New', monospace" font-size="54" font-weight="700" letter-spacing="3" fill="#121826">${esc(p.id)}</text>
${p.orcid ? `<text x="64" y="484" font-family="'Courier New', monospace" font-size="22" fill="#4A5263">ORCID ${esc(p.orcid)}</text>` : ""}
<rect x="720" y="150" width="270" height="270" rx="12" fill="#FFFFFF" stroke="#DADDE3" stroke-width="2"/>
<image href="${qr}" x="740" y="170" width="230" height="230"/>
<text x="855" y="452" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#4A5263">ID only — never signs you in</text>
<rect x="0" y="536" width="1050" height="64" fill="#F5F6F3"/><text x="64" y="576" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#4A5263">Share it with co-authors and chairs so they can find you.</text>
</svg>`;
}

function save(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function BadgeDownload(p: { name: string; affiliation: string; id: string; orcid: string | null; qrSvg: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const pdf = async () => {
    setErr(false);
    const res = await fetch("/api/badge").catch(() => null);
    if (!res?.ok) { setErr(true); return; }
    save(await res.blob(), `plenary-id-${p.id}.pdf`);
  };
  const png = async () => {
    setBusy(true);
    try {
      const url = URL.createObjectURL(new Blob([badgeSvg(p)], { type: "image/svg+xml" }));
      const img = new Image();
      await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error("image")); img.src = url; });
      const c = document.createElement("canvas");
      c.width = 2100; c.height = 1200;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(img, 0, 0, 2100, 1200);
      URL.revokeObjectURL(url);
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/png"));
      if (!blob) throw new Error("png");
      save(blob, `plenary-id-${p.id}.png`);
    } catch {
      await pdf(); // browsers that refuse to export the canvas still get the PDF
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="flex items-center gap-3">
      <span>{t("Save badge")}:</span>
      <button type="button" onClick={png} disabled={busy} className="border-0 bg-transparent p-0 text-[12px] font-semibold text-[#2F5FD0] underline disabled:opacity-60">{busy ? t("Preparing…") : "PNG"}</button>
      <button type="button" onClick={pdf} className="border-0 bg-transparent p-0 text-[12px] font-semibold text-[#2F5FD0] underline">PDF</button>
      {err ? <span role="alert" className="text-[12px] text-[#B3261E]">{t("Couldn't prepare the badge. Try again.")}</span> : null}
    </span>
  );
}
