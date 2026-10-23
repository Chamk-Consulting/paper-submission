import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { loadSubmission } from "@/lib/submission/data";
import { DECISION_LABEL, loadDecision } from "@/lib/submission/followup-data";
import { mdToPlain } from "@/lib/rich-text/plain";
import { getBrand } from "@/lib/config/brand";

/*
 * Decision letter as a PDF (paper status › "Download decision letter"): proof of acceptance for visas, travel funding
 * and institutions. Only the paper's authors can load the submission (RLS) and only a released decision is shown.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [ctx, decision, brand] = await Promise.all([loadSubmission(id), loadDecision(id), getBrand()]);
  if (!ctx || !ctx.sub.number || !decision) return new Response("Not found", { status: 404 });
  const { sub, venue, authors } = ctx;

  const doc = await PDFDocument.create();
  doc.setTitle(`${venue.acr} decision letter #${sub.number}`);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.055, 0.106, 0.239), muted = rgb(0.29, 0.32, 0.39), green = rgb(0.08, 0.38, 0.25);
  let page = doc.addPage([595, 842]);
  let y = 780;
  // Standard fonts only cover Latin-1: anything else (maths, other scripts) is replaced, never dropped silently.
  const clean = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
  const line = (text: string, size = 11, font = sans, color = navy, gap = 5) => {
    for (const para of clean(text).split("\n")) {
      let cur = "";
      for (const w of para.split(" ")) {
        if (font.widthOfTextAtSize(`${cur} ${w}`, size) > 475) { flush(cur, size, font, color, gap); cur = w; } else cur = cur ? `${cur} ${w}` : w;
      }
      flush(cur, size, font, color, gap);
    }
  };
  const flush = (s: string, size: number, font: typeof sans, color: typeof navy, gap: number) => {
    if (y < 70) { page = doc.addPage([595, 842]); y = 780; }
    if (s) page.drawText(s, { x: 60, y, size, font, color });
    y -= size + gap;
  };

  page.drawCircle({ x: 68, y: 794, size: 8, borderColor: navy, borderWidth: 1 });
  page.drawCircle({ x: 68, y: 794, size: 2.2, color: rgb(0.95, 0.66, 0.23) });
  page.drawText(clean(brand), { x: 82, y: 788, size: 18, font: serif, color: navy });
  y = 740;
  line("DECISION LETTER", 9, bold, muted);
  line(`${venue.acr} - ${venue.name}`, 13, serif, navy, 8);
  const released = new Date(decision.releasedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  line(released, 10, sans, muted, 14);

  const rows: [string, string][] = [
    ["Paper", `#${String(sub.number).padStart(4, "0")} - ${mdToPlain(sub.title)}`],
    ["Authors", authors.map((a) => `${a.name}${a.institution ? ` (${a.institution})` : ""}`).join("; ")],
    ["Type", sub.paperType],
    ["Decision", DECISION_LABEL[decision.decision] ?? decision.decision],
  ];
  for (const [k, v] of rows) { line(k, 9, bold, muted, 3); line(v, k === "Decision" ? 13 : 11, k === "Decision" ? bold : sans, k === "Decision" && decision.decision.startsWith("accept") ? green : navy, 9); }
  y -= 6;
  line(mdToPlain(decision.letter) || "The program committee has reached a decision on your paper. The reviews are available on your paper page.", 11, serif, navy, 5);
  if (decision.editorSummary) { y -= 8; line("Summary from the editor", 9, bold, muted, 3); line(mdToPlain(decision.editorSummary), 11, serif, navy, 5); }
  if (venue.startsOn) {
    y -= 8;
    const when = new Date(venue.startsOn).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    line(`The conference starts on ${when}${venue.location ? ` in ${venue.location}` : ""}.`, 11, serif, navy, 5);
  }
  y -= 16;
  line(`Issued by ${brand} on behalf of the ${venue.acr} program committee. Quote the paper number in any correspondence.`, 9, sans, muted);

  const bytes = await doc.save();
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${venue.slug}-decision-${sub.number}.pdf"`, "cache-control": "private, no-store" },
  });
}
