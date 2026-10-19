import { createClient } from "@/lib/supabase/server";
import { MUTED, NAVY, PDFDocument, SAFFRON, fonts, logo, pdfResponse, wrap } from "@/lib/manage/orgtools-pdf";

/* EM34 — award certificate: one landscape page per author. Authors of the winning paper and organizers, once announced. */

type Cert = { award: string; venue: string; venue_short: string | null; starts_on: string | null; ends_on: string | null; title: string; number: number; authors: string[]; announced_at: string };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const { data } = await supabase.rpc("award_certificate", { p_award: id });
  const c = ((data ?? []) as Cert[])[0];
  if (!c) return new Response("Not found", { status: 404 });

  const doc = await PDFDocument.create();
  doc.setTitle(`${c.award} - ${c.venue_short ?? c.venue}`);
  const { serif, sans, bold } = await fonts(doc);
  const when = [c.starts_on, c.ends_on].filter(Boolean).join(" to ");
  for (const name of c.authors.length ? c.authors : [""]) {
    const page = doc.addPage([842, 595]);
    page.drawRectangle({ x: 24, y: 24, width: 794, height: 547, borderColor: NAVY, borderWidth: 1.2 });
    page.drawRectangle({ x: 32, y: 32, width: 778, height: 531, borderColor: SAFFRON, borderWidth: 0.6 });
    logo(page, 380, 520, serif);
    let y = wrap(page, (c.venue_short ?? c.venue).toUpperCase(), { x: 60, y: 470, width: 722, size: 11, font: bold, color: MUTED, center: true });
    y = wrap(page, c.award, { x: 60, y: y - 14, width: 722, size: 40, font: serif, center: true, gap: 10 });
    y = wrap(page, "is awarded to", { x: 60, y: y - 6, width: 722, size: 13, font: sans, color: MUTED, center: true });
    if (name) y = wrap(page, name, { x: 60, y: y - 12, width: 722, size: 30, font: serif, center: true });
    y = wrap(page, "for the paper", { x: 60, y: y - 8, width: 722, size: 13, font: sans, color: MUTED, center: true });
    y = wrap(page, `"${c.title}"`, { x: 100, y: y - 8, width: 642, size: 18, font: serif, center: true, gap: 6 });
    wrap(page, c.authors.join(", "), { x: 100, y: y - 4, width: 642, size: 11, font: sans, color: MUTED, center: true });
    wrap(page, `${c.venue}${when ? ` - ${when}` : ""}`, { x: 60, y: 92, width: 722, size: 11, font: sans, color: MUTED, center: true });
    wrap(page, `Paper #${String(c.number).padStart(4, "0")} - announced ${c.announced_at.slice(0, 10)} - issued by Plenary`, { x: 60, y: 72, width: 722, size: 9, font: sans, color: MUTED, center: true });
  }
  return pdfResponse(await doc.save(), `certificate-${String(c.number).padStart(4, "0")}.pdf`);
}
