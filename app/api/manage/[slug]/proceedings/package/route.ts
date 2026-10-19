import { createClient } from "@/lib/supabase/server";
import { keptPapers, pdfName, xploreCsv, xploreReadme, xploreXml, type XPaper, type XVenue } from "@/lib/manage/xplore";

/*
 * EM32 — the IEEE Xplore upload package as a manifest: metadata files as text plus short-lived signed links to each
 * final PDF. The browser downloads the PDFs and zips everything itself, so no file size limit applies here.
 * Same access as the XML: organizers with a proceedings role (RPC role check + storage RLS).
 */

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug)) return Response.json({ error: "not_found" }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "sign_in" }, { status: 401 });
  const { data: venue } = await supabase.from("venues").select("id, name, short_name, starts_on, ends_on, location").eq("slug", slug).maybeSingle();
  if (!venue) return Response.json({ error: "not_found" }, { status: 404 });
  const { data, error } = await supabase.rpc("proceedings_papers", { p_venue: venue.id });
  if (error) return Response.json({ error: "forbidden" }, { status: 403 });
  const papers = keptPapers((data ?? []) as XPaper[]);

  const withFile = papers.filter((p) => p.file_path);
  const signed = withFile.length
    ? (await supabase.storage.from("papers").createSignedUrls(withFile.map((p) => p.file_path!), 900)).data ?? []
    : [];
  const urlByPath = new Map(signed.filter((s) => s.signedUrl && s.path).map((s) => [s.path as string, s.signedUrl]));
  const files = withFile.filter((p) => urlByPath.has(p.file_path!)).map((p) => ({ name: `pdf/${pdfName(p)}`, url: urlByPath.get(p.file_path!)! }));
  const missing = papers.filter((p) => !p.file_path || !urlByPath.has(p.file_path)).map((p) => `#${String(p.number).padStart(4, "0")}`);

  return Response.json({
    name: `${slug}-xplore-package.zip`,
    papers: papers.length,
    missing,
    texts: [
      { name: "metadata.xml", text: xploreXml(venue as XVenue, papers, true) },
      { name: "metadata.csv", text: xploreCsv(papers) },
      { name: "README.txt", text: xploreReadme(venue as XVenue, papers, missing) },
    ],
    files,
  }, { headers: { "cache-control": "private, no-store" } });
}
