import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PP01 "Slides": slides of a talk in a published program are public; redirect to a short-lived signed URL.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string; number: string }> }) {
  const { slug, number } = await params;
  const n = Number(number);
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(slug) || !Number.isInteger(n) || n < 1) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: venue } = await supabase.from("venues").select("id").eq("slug", slug).maybeSingle();
  if (!venue) return new Response("Not found", { status: 404 });
  const { data: path } = await supabase.rpc("paper_slides_path", { p_venue: venue.id, p_number: n });
  if (!path) return new Response("Not found", { status: 404 });
  const { data: signed } = await supabase.storage.from("papers").createSignedUrl(path as string, 300, { download: `slides-${String(n).padStart(4, "0")}.pdf` });
  if (!signed?.signedUrl) return new Response("Not found", { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { headers: { "cache-control": "private, no-store" } });
}
