import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* ST05 — download your own export. Re-checks the session on every click; the storage link lives 60 seconds. */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/sign-in?next=${encodeURIComponent("/settings/privacy/export")}`, req.url));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

  // RLS: only the owner's requests are visible
  const { data: r } = await supabase.from("data_requests").select("status, file_path, detail, kind").eq("id", id).maybeSingle();
  const expires = (r?.detail as { expires_at?: string } | null)?.expires_at;
  if (!r || r.kind !== "export" || r.status !== "ready" || !r.file_path || (expires && Date.parse(expires) < Date.now())) {
    return NextResponse.redirect(new URL("/settings/privacy/export?expired=1", req.url));
  }
  const { data, error } = await supabase.storage.from("exports").createSignedUrl(r.file_path as string, 60, { download: "plenary-export.zip" });
  if (error || !data?.signedUrl) return new NextResponse("Not available", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "cache-control": "no-store" } });
}
