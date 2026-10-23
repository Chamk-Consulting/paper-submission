import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FolioFile, FolioPaperProps } from "@/components/folio/editor";

/** The signed-in person (id + name for cursors), or null. */
export async function folioMe() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: p } = await supabase.from("persons").select("id, display_name, given_name, family_name").eq("user_id", auth.user.id).maybeSingle();
  if (!p) return null;
  const name = p.display_name || [p.given_name, p.family_name].filter(Boolean).join(" ") || auth.user.email?.split("@")[0] || "Co-author";
  return { personId: p.id as string, name };
}

export async function loadFolioPaper(id: string): Promise<FolioPaperProps | null> {
  const me = await folioMe();
  if (!me) return null;
  const supabase = await createClient();
  const [{ data: paper }, { data: files }, { data: member }] = await Promise.all([
    supabase.from("folio_papers").select("id, title, engine, main_file, status").eq("id", id).maybeSingle(),
    supabase.from("folio_files").select("id, path, kind, size_bytes").eq("paper_id", id).order("path"),
    supabase.from("folio_members").select("role").eq("paper_id", id).eq("person_id", me.personId).maybeSingle(),
  ]);
  if (!paper || !member) return null;
  return {
    paper: { id: paper.id, title: paper.title, engine: paper.engine, mainFile: paper.main_file, status: paper.status },
    files: (files ?? []).map((f) => ({ id: f.id, path: f.path, kind: f.kind, size: Number(f.size_bytes) }) as FolioFile),
    role: member.role,
    me,
  };
}

export type FolioListItem = { id: string; title: string; updatedAt: string; role: string; status: string; template: string | null };

export async function listFolioPapers(): Promise<FolioListItem[]> {
  const me = await folioMe();
  if (!me) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("folio_members")
    .select("role, folio_papers!inner(id, title, updated_at, status, template_key)")
    .eq("person_id", me.personId);
  return ((data ?? []) as unknown as { role: string; folio_papers: { id: string; title: string; updated_at: string; status: string; template_key: string | null } }[])
    .map((r) => ({ id: r.folio_papers.id, title: r.folio_papers.title, updatedAt: r.folio_papers.updated_at, role: r.role, status: r.folio_papers.status, template: r.folio_papers.template_key }))
    .filter((p) => p.status !== "trashed")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
