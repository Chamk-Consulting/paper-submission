import "server-only";
import { PDFDict, PDFDocument, PDFName, PDFRef, type PDFObject } from "pdf-lib";
import { getDocumentProxy } from "unpdf";

export type I18n = { key: string; vars?: Record<string, string | number> };
/** label/value/detail are English (stored in the DB); `i18n`/`valueI18n` carry templates + vars for translation at display time. */
export type CheckItem = { key: "size" | "length" | "fonts" | "margins" | "anonymity" | "file"; label: string; value: string; detail: string; level: "ok" | "warn" | "fail"; i18n?: I18n; valueI18n?: I18n };
export type CheckResult = { status: "passed" | "warnings" | "failed"; pages: number; items: CheckItem[] };

/** "6 + 2 pp" → {included: 6, extra: 2}; "8 pp" → {8, 0}; "4–8 pp" → {8, 0}; "No limit" → null. */
export function parsePageLimit(s: string | null | undefined): { included: number; extra: number } | null {
  if (!s) return null;
  const plus = s.match(/(\d+)\s*\+\s*(\d+)/);
  if (plus) return { included: Number(plus[1]), extra: Number(plus[2]) };
  const nums = [...s.matchAll(/\d+/g)].map((m) => Number(m[0]));
  return nums.length ? { included: Math.max(...nums), extra: 0 } : null;
}

const near = (a: number, b: number) => Math.abs(a - b) <= 4;
function paperName(w: number, h: number) {
  const [x, y] = w < h ? [w, h] : [h, w];
  if (near(x, 595) && near(y, 842)) return "A4";
  if (near(x, 612) && near(y, 792)) return "US Letter";
  return `${Math.round(w)} × ${Math.round(h)} pt`;
}

/** Walks page resources (and form XObjects one level down) for fonts without an embedded font program. */
function unembeddedFonts(doc: PDFDocument): string[] {
  const missing = new Set<string>();
  const ctx = doc.context;
  const look = (o: PDFObject | undefined) => (o instanceof PDFRef ? ctx.lookup(o) : o);
  const checkFont = (font: PDFDict) => {
    const subtype = font.get(PDFName.of("Subtype"))?.toString();
    if (subtype === "/Type3") return;
    let target = font;
    if (subtype === "/Type0") {
      const desc = look(font.get(PDFName.of("DescendantFonts")));
      const first = desc && "get" in desc && typeof (desc as { get: unknown }).get === "function" ? look((desc as unknown as { get(i: number): PDFObject }).get(0)) : undefined;
      if (first instanceof PDFDict) target = first;
    }
    const fd = look(target.get(PDFName.of("FontDescriptor")));
    const name = (font.get(PDFName.of("BaseFont"))?.toString() ?? "unknown").replace(/^\//, "").replace(/^[A-Z]{6}\+/, "");
    if (!(fd instanceof PDFDict)) { missing.add(name); return; }
    const embedded = ["FontFile", "FontFile2", "FontFile3"].some((k) => fd.has(PDFName.of(k)));
    if (!embedded) missing.add(name);
  };
  const scanResources = (res: PDFObject | undefined, depth: number) => {
    const r = look(res);
    if (!(r instanceof PDFDict)) return;
    const fonts = look(r.get(PDFName.of("Font")));
    if (fonts instanceof PDFDict) for (const [, v] of fonts.entries()) { const f = look(v); if (f instanceof PDFDict) checkFont(f); }
    if (depth > 0) {
      const xo = look(r.get(PDFName.of("XObject")));
      if (xo instanceof PDFDict) for (const [, v] of xo.entries()) {
        const x = look(v);
        const dict = x && "dict" in (x as object) ? (x as unknown as { dict: PDFDict }).dict : undefined;
        if (dict && dict.get(PDFName.of("Subtype"))?.toString() === "/Form") scanResources(dict.get(PDFName.of("Resources")), depth - 1);
      }
    }
  };
  for (const page of doc.getPages()) scanResources(page.node.get(PDFName.of("Resources")), 2);
  return [...missing];
}

export async function checkPdf(
  bytes: Uint8Array,
  opts: { pageLimit: string | null; doubleBlind: boolean; names: string[]; institutions: string[] },
): Promise<CheckResult> {
  const items: CheckItem[] = [];
  const sizeMb = (bytes.byteLength / 1048576).toFixed(1);

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    const encrypted = /encrypt/i.test(String(e));
    const detail = encrypted ? "The PDF is password-protected or encrypted. Save it again without protection." : "This file can't be opened as a PDF. Export it again from Word or LaTeX.";
    items.push({ key: "file", label: "File", value: `${sizeMb} MB`, detail, level: "fail", i18n: { key: detail }, valueI18n: { key: "{mb} MB", vars: { mb: sizeMb } } });
    return { status: "failed", pages: 0, items };
  }
  const pages = doc.getPageCount();

  // Page size
  const sizes = new Set(doc.getPages().map((p) => paperName(p.getWidth(), p.getHeight())));
  const okSize = [...sizes].every((s) => s === "A4" || s === "US Letter");
  const sizeDetail = okSize ? "Matches the template." : "Use A4 or US Letter pages, as in the venue template.";
  items.push({ key: "size", label: "Page size", value: [...sizes].join(", "), detail: sizeDetail, level: okSize ? "ok" : "fail", i18n: { key: sizeDetail } });

  // Length
  const lim = parsePageLimit(opts.pageLimit);
  if (lim) {
    const extra = Math.max(0, pages - lim.included);
    const over = pages > lim.included + lim.extra;
    const i18n: I18n = over
      ? (lim.extra ? { key: "Over the limit: {inc} + {extra} extra pages at most. Papers over the limit are returned without review.", vars: { inc: lim.included, extra: lim.extra } } : { key: "Over the limit: {inc} pages at most. Papers over the limit are returned without review.", vars: { inc: lim.included } })
      : extra ? { key: extra === 1 ? "{inc} + {n} extra page — an extra-page fee applies at registration." : "{inc} + {n} extra pages — an extra-page fee applies at registration.", vars: { inc: lim.included, n: extra } }
      : { key: "Within {inc} pages.", vars: { inc: lim.included } };
    items.push({
      key: "length", label: "Length", value: `${pages} pages`,
      detail: over ? `Over the limit: ${lim.included}${lim.extra ? ` + ${lim.extra} extra` : ""} pages at most. Papers over the limit are returned without review.`
        : extra ? `${lim.included} + ${extra} extra page${extra === 1 ? "" : "s"} — an extra-page fee applies at registration.` : `Within ${lim.included} pages.`,
      level: over ? "fail" : extra ? "warn" : "ok", i18n, valueI18n: { key: "{n} pages", vars: { n: pages } },
    });
  } else items.push({ key: "length", label: "Length", value: `${pages} pages`, detail: "No page limit for this type.", level: "ok", i18n: { key: "No page limit for this type." }, valueI18n: { key: "{n} pages", vars: { n: pages } } });

  // Fonts
  const missing = unembeddedFonts(doc);
  items.push({
    key: "fonts", label: "Fonts", value: missing.length ? `${missing.length} not embedded` : "all embedded",
    detail: missing.length ? `${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""} ${missing.length === 1 ? "is" : "are"} not embedded. Re-export with fonts embedded.` : "Every font is embedded.",
    level: missing.length ? "fail" : "ok",
    i18n: missing.length
      ? { key: missing.length === 1 ? "{fonts} is not embedded. Re-export with fonts embedded." : "{fonts} are not embedded. Re-export with fonts embedded.", vars: { fonts: `${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}` } }
      : { key: "Every font is embedded." },
    valueI18n: missing.length ? { key: "{n} not embedded", vars: { n: missing.length } } : { key: "all embedded" },
  });

  // Text-based checks (margins, anonymity) with pdf.js
  let marginHits = 0;
  let firstPageText = "";
  let metaAuthor = "";
  try {
    const pdf = await getDocumentProxy(bytes);
    const meta = await pdf.getMetadata().catch(() => null);
    metaAuthor = String((meta?.info as Record<string, unknown> | undefined)?.Author ?? "").trim();
    const n = Math.min(pdf.numPages, 12);
    for (let i = 1; i <= n; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      for (const it of tc.items as { str?: string; transform?: number[]; width?: number }[]) {
        if (!it.str?.trim() || !it.transform) continue;
        const x = it.transform[4], y = it.transform[5], w = it.width ?? 0;
        if (x < 18 || y < 18 || x + w > vp.width - 18 || y > vp.height - 18) marginHits++;
        if (i === 1) firstPageText += ` ${it.str}`;
      }
    }
  } catch {
    // pdf.js couldn't read the text layer — skip those checks rather than block the author.
  }
  items.push({
    key: "margins", label: "Margins", value: marginHits ? "text near the edge" : "within template",
    detail: marginHits ? `${marginHits} line${marginHits === 1 ? "" : "s"} of text run into the margins. Check figures and long equations.` : "Nothing runs into the margins.", level: marginHits ? "warn" : "ok",
    i18n: marginHits ? { key: marginHits === 1 ? "{n} line of text runs into the margins. Check figures and long equations." : "{n} lines of text run into the margins. Check figures and long equations.", vars: { n: marginHits } } : { key: "Nothing runs into the margins." },
    valueI18n: { key: marginHits ? "text near the edge" : "within template" },
  });

  if (opts.doubleBlind) {
    const text = firstPageText.toLowerCase();
    const hits = [...new Set([...opts.names, ...opts.institutions].map((s) => s.trim()).filter((s) => s.length >= 4 && text.includes(s.toLowerCase())))];
    const problems = [...hits.map((h) => `"${h}" appears on page 1`), ...(metaAuthor ? [`the file properties list an author ("${metaAuthor.slice(0, 40)}")`] : [])];
    const found = [...hits.map((h) => `"${h}"`), ...(metaAuthor ? [`"${metaAuthor.slice(0, 40)}"`] : [])].join(", ");
    items.push({
      key: "anonymity", label: "Anonymity", value: problems.length ? "check page 1" : "no names found",
      detail: problems.length ? `${problems.join("; ")}. Double-blind: remove names and affiliations.` : "No author names or affiliations found on page 1 or in the file properties.", level: problems.length ? "warn" : "ok",
      i18n: problems.length ? { key: "Names or affiliations found on page 1 or in the file properties: {found}. Double-blind: remove names and affiliations.", vars: { found } } : { key: "No author names or affiliations found on page 1 or in the file properties." },
      valueI18n: { key: problems.length ? "check page 1" : "no names found" },
    });
  }

  items.push({ key: "file", label: "File", value: `${sizeMb} MB, not encrypted`, detail: "Opens and prints correctly.", level: "ok", i18n: { key: "Opens and prints correctly." }, valueI18n: { key: "{mb} MB, not encrypted", vars: { mb: sizeMb } } });
  const status = items.some((i) => i.level === "fail") ? "failed" : items.some((i) => i.level === "warn") ? "warnings" : "passed";
  return { status, pages, items };
}
