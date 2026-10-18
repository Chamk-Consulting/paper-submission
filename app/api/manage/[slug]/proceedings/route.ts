import { createClient } from "@/lib/supabase/server";

/*
 * EM32 step 4 — proceedings metadata as XML for the IEEE Conference Publishing portal (one <paper> per kept paper:
 * presented, or a no-show kept by exception). Organizers with a proceedings role only; RLS + the RPC's role check apply.
 */

type Author = { name: string | null; given: string | null; family: string | null; affiliation: string | null; orcid: string | null };
type Paper = { number: number; title: string; locked_title: string | null; abstract: string | null; pages: number | null; file_path: string | null; authors: Author[]; attendance: string | null; noshow_decision: string | null; session_code: string | null; final_status: string | null };

const esc = (s: string | number | null | undefined) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const { data: venue } = await supabase.from("venues").select("id, name, short_name, starts_on, ends_on, location").eq("slug", slug).maybeSingle();
  if (!venue) return new Response("Not found", { status: 404 });
  const { data, error } = await supabase.rpc("proceedings_papers", { p_venue: venue.id });
  if (error) return new Response("Not allowed", { status: 403 });
  const papers = ((data ?? []) as Paper[]).filter((p) => p.final_status !== "dropped" && (p.attendance === "presented" || (p.attendance === "no_show" && p.noshow_decision === "keep")));
  if (!papers.length && !(data ?? []).length) return new Response("Not allowed or nothing to export", { status: 403 });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<proceedings generator="Plenary" exported="${new Date().toISOString()}">`,
    `  <conference acronym="${esc(venue.short_name ?? "")}" start="${esc(venue.starts_on)}" end="${esc(venue.ends_on)}" location="${esc(venue.location)}">`,
    `    <title>${esc(venue.name)}</title>`,
    "  </conference>",
    ...papers.map((p) => [
      `  <paper id="${esc(String(p.number).padStart(4, "0"))}" session="${esc(p.session_code)}"${p.pages ? ` pages="${p.pages}"` : ""}${p.attendance === "no_show" ? ' presented="exception"' : ""}>`,
      `    <title>${esc(p.locked_title ?? p.title)}</title>`,
      "    <authors>",
      ...p.authors.map((a, i) => `      <author seq="${i + 1}"${a.orcid ? ` orcid="${esc(a.orcid)}"` : ""}><given>${esc(a.given)}</given><family>${esc(a.family ?? a.name)}</family><affiliation>${esc(a.affiliation)}</affiliation></author>`),
      "    </authors>",
      p.abstract ? `    <abstract>${esc(p.abstract)}</abstract>` : "",
      p.file_path ? `    <pdf file="${esc(p.file_path.split("/").pop())}" />` : "",
      "  </paper>",
    ].filter(Boolean).join("\n")),
    "</proceedings>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-xplore.xml"`,
      "Cache-Control": "private, no-store",
    },
  });
}
