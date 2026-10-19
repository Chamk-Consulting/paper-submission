import "server-only";
import { createClient } from "@/lib/supabase/server";

/* ST05 reads. RLS: only the signed-in person's own rows. */

export type DataReq = {
  id: string; kind: "export" | "delete" | "merge" | "import"; status: string; created_at: string; updated_at: string;
  scheduled_for: string | null; blocked_reason: string | null; file_path: string | null;
  detail: { bytes?: number; expires_at?: string; files_included?: number; files_skipped?: number; expired?: boolean } | null;
};
export type ExportPage = { requests: DataReq[]; latest: DataReq | null; counts: { papers: number | null; reviews: number | null; threads: number | null; registrations: number | null } };

export async function getExportPage(): Promise<ExportPage | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: person } = await supabase.from("persons").select("id").eq("user_id", auth.user.id).maybeSingle();
  if (!person) return null;
  const pid = person.id as string;
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => { const r = await q; return r.error ? null : r.count ?? 0; };
  const [reqs, papers, reviews, threads, regs] = await Promise.all([
    supabase.from("data_requests").select("id, kind, status, created_at, updated_at, scheduled_for, blocked_reason, file_path, detail").order("created_at", { ascending: false }).limit(20),
    count(supabase.from("submission_authors").select("submission_id", { count: "exact", head: true }).eq("person_id", pid)),
    count(supabase.from("review_assignments").select("id", { count: "exact", head: true }).eq("reviewer_id", pid).in("status", ["accepted", "submitted"])),
    count(supabase.from("inbox_participants").select("thread_id", { count: "exact", head: true }).eq("person_id", pid)),
    count(supabase.from("registrations").select("id", { count: "exact", head: true }).eq("person_id", pid)),
  ]);
  const requests = ((reqs.data ?? []) as DataReq[]).map((r) => {
    const exp = r.detail?.expires_at;
    return r.kind === "export" && r.status === "ready" && exp && Date.parse(exp) < Date.now() ? { ...r, status: "expired" } : r;
  });
  return { requests, latest: requests.find((r) => r.kind === "export") ?? null, counts: { papers, reviews, threads, registrations: regs } };
}
