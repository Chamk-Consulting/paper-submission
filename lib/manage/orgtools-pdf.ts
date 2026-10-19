import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/* PDFs for BL01 invoices and EM34 award certificates (standard fonts: Latin-1 only, other characters become "?"). */

export const NAVY = rgb(0.055, 0.106, 0.239), MUTED = rgb(0.29, 0.32, 0.39), SAFFRON = rgb(0.95, 0.66, 0.23);
export const clean = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7E -ÿ]/g, "?");

export async function fonts(doc: PDFDocument) {
  return { serif: await doc.embedFont(StandardFonts.TimesRoman), sans: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
}

export function logo(page: PDFPage, x: number, y: number, serif: PDFFont) {
  page.drawCircle({ x: x + 8, y: y + 6, size: 8, borderColor: NAVY, borderWidth: 1 });
  page.drawCircle({ x: x + 8, y: y + 6, size: 2.2, color: SAFFRON });
  page.drawText("Plenary", { x: x + 22, y, size: 18, font: serif, color: NAVY });
}

/** Draw wrapped text; returns the new y. `center` centres each line within [x, x + width]. */
export function wrap(page: PDFPage, text: string, o: { x: number; y: number; width: number; size: number; font: PDFFont; color?: ReturnType<typeof rgb>; gap?: number; center?: boolean }) {
  const words = clean(text).split(/\s+/).filter(Boolean);
  let line = "", y = o.y;
  const flush = () => {
    if (!line) return;
    const w = o.font.widthOfTextAtSize(line, o.size);
    page.drawText(line, { x: o.center ? o.x + (o.width - w) / 2 : o.x, y, size: o.size, font: o.font, color: o.color ?? NAVY });
    y -= o.size + (o.gap ?? 6);
  };
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (o.font.widthOfTextAtSize(next, o.size) > o.width && line) { flush(); line = w; } else line = next;
  }
  flush();
  return y;
}

export const pdfResponse = (bytes: Uint8Array, filename: string) =>
  new Response(new Uint8Array(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });

export { PDFDocument };
