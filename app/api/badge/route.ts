import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { getMe } from "@/lib/auth/me";

// PR09 "Save badge" as PDF: the signed-in person's Plenary ID card (business-card size, 85 × 55 mm).
export async function GET() {
  const me = await getMe();
  if (!me) return new Response("Sign in first", { status: 401 });
  const p = me.person;
  const id = p?.plenary_id;
  if (!id) return new Response("Your Plenary ID is being issued — try again in a moment.", { status: 404 });

  const mm = (n: number) => (n * 72) / 25.4;
  const W = mm(85), H = mm(55);
  const doc = await PDFDocument.create();
  doc.setTitle(`Plenary ID ${id}`);
  const page = doc.addPage([W, H]);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.CourierBold);
  const navy = rgb(0.055, 0.106, 0.239), ink = rgb(0.07, 0.094, 0.149), muted = rgb(0.29, 0.32, 0.39), saffron = rgb(0.949, 0.663, 0.231);
  const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "?");
  const fit = (s: string, font: typeof sans, size: number, max: number) => {
    const full = clean(s);
    if (font.widthOfTextAtSize(full, size) <= max) return full;
    let t = full;
    while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > max) t = t.slice(0, -1);
    return `${t.trimEnd()}...`;
  };

  page.drawRectangle({ x: 0, y: H - mm(2.2), width: W, height: mm(2.2), color: navy });
  page.drawCircle({ x: mm(7), y: H - mm(8), size: mm(2.2), borderColor: ink, borderWidth: 0.8 });
  page.drawCircle({ x: mm(7), y: H - mm(8), size: mm(0.6), color: saffron });
  page.drawText("Plenary", { x: mm(10.5), y: H - mm(9.3), size: 11, font: serif, color: ink });

  const name = (p.badge_name || p.paper_name || p.display_name || me.email).trim();
  page.drawText(fit(name, serif, 13, mm(48)), { x: mm(6), y: H - mm(19), size: 13, font: serif, color: ink });
  if (me.affiliation?.institution) page.drawText(fit(me.affiliation.institution, sans, 7, mm(48)), { x: mm(6), y: H - mm(23.5), size: 7, font: sans, color: muted });
  page.drawText("PLENARY ID", { x: mm(6), y: H - mm(33), size: 5.5, font: sans, color: muted });
  page.drawText(id, { x: mm(6), y: H - mm(38.5), size: 12, font: mono, color: ink });
  if (p.orcid) page.drawText(`ORCID ${clean(p.orcid)}`, { x: mm(6), y: H - mm(43), size: 6, font: sans, color: muted });

  // QR (ID only) drawn as vector modules.
  const qr = QRCode.create(id, { errorCorrectionLevel: "M" });
  const n = qr.modules.size, box = mm(24), cell = box / n, x0 = W - mm(6) - box, y0 = H - mm(12) - box;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.modules.get(r, c)) page.drawRectangle({ x: x0 + c * cell, y: y0 + (n - 1 - r) * cell, width: cell + 0.05, height: cell + 0.05, color: navy });
  }
  page.drawText("ID only", { x: x0 + box / 2 - sans.widthOfTextAtSize("ID only", 5.5) / 2, y: y0 - mm(3), size: 5.5, font: sans, color: muted });

  page.drawRectangle({ x: 0, y: 0, width: W, height: mm(6), color: rgb(0.96, 0.965, 0.953) });
  page.drawText("Finds you for co-authors and chairs - never signs you in.", { x: mm(6), y: mm(2.2), size: 5.5, font: sans, color: muted });

  const bytes = await doc.save();
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="plenary-id-${id}.pdf"`, "cache-control": "private, no-store" },
  });
}
