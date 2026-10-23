"use server";

import * as Y from "yjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { templateByKey } from "@/lib/folio/templates";
import { toBytea } from "@/lib/folio/bytes";

async function me() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { supabase, personId: null as string | null };
  const { data: person } = await supabase.from("persons").select("id").eq("user_id", auth.user.id).maybeSingle();
  return { supabase, personId: person?.id ?? null };
}

/** New paper from a starter template: the paper row, its files, and each text file's first Yjs update. */
export async function createFolioPaper(formData: FormData) {
  const { supabase, personId } = await me();
  const lang = await getLocale();
  if (!personId) redirect(`/${lang}/sign-in?next=/folio`);
  const tpl = templateByKey(String(formData.get("template") ?? "ieee-conference"));
  const title = String(formData.get("title") ?? "").trim().slice(0, 300) || "Untitled paper";
  const id = crypto.randomUUID();

  const { error } = await supabase.from("folio_papers").insert({ id, owner_id: personId, title, engine: tpl.engine, template_key: tpl.key });
  if (error) throw new Error("Could not create the paper");

  const files = tpl.files.map((f) => ({ id: crypto.randomUUID(), paper_id: id, path: f.path, kind: "text", size_bytes: f.content.length }));
  const { error: fErr } = await supabase.from("folio_files").insert(files);
  if (fErr) throw new Error("Could not create the paper files");

  const updates = tpl.files.map((f, i) => {
    const doc = new Y.Doc();
    doc.getText("t").insert(0, f.content);
    return { paper_id: id, file_id: files[i].id, update: toBytea(Y.encodeStateAsUpdate(doc)), author_id: personId };
  });
  const { error: uErr } = await supabase.from("folio_updates").insert(updates);
  if (uErr) throw new Error("Could not save the paper text");

  revalidatePath(`/${lang}/folio`);
  redirect(`/${lang}/folio/${id}`);
}

export async function renameFolioPaper(paperId: string, title: string) {
  const { supabase } = await me();
  const t = title.trim().slice(0, 300);
  if (!t) return { ok: false };
  const { error } = await supabase.from("folio_papers").update({ title: t }).eq("id", paperId);
  return { ok: !error };
}

export async function setFolioEngine(paperId: string, engine: "pdflatex" | "lualatex" | "xelatex") {
  const { supabase } = await me();
  const { error } = await supabase.from("folio_papers").update({ engine }).eq("id", paperId);
  return { ok: !error };
}

const PATH_RE = /^[A-Za-z0-9._/-]{1,240}$/;
const okPath = (p: string) => PATH_RE.test(p) && !p.startsWith("/") && !p.split("/").some((s) => s === ".." || s === "");

/** A new empty text file (.tex, .bib, .sty, .cls, .txt, .md…). Returns its id. */
export async function addFolioTextFile(paperId: string, path: string) {
  const { supabase, personId } = await me();
  if (!personId || !okPath(path)) return { ok: false as const, error: "bad_path" };
  const id = crypto.randomUUID();
  const { error } = await supabase.from("folio_files").insert({ id, paper_id: paperId, path, kind: "text" });
  if (error) return { ok: false as const, error: error.code === "23505" ? "exists" : "failed" };
  return { ok: true as const, id };
}

/** Record a binary file the browser already uploaded to storage at {paper}/files/{path}. */
export async function addFolioBinaryFile(paperId: string, path: string, size: number, hash: string) {
  const { supabase, personId } = await me();
  if (!personId || !okPath(path)) return { ok: false as const, error: "bad_path" };
  const storage_key = `${paperId}/files/${path}`;
  const { data: existing } = await supabase.from("folio_files").select("id").eq("paper_id", paperId).eq("path", path).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("folio_files").update({ size_bytes: size, content_hash: hash, storage_key, kind: "binary" }).eq("id", existing.id);
    return error ? { ok: false as const, error: "failed" } : { ok: true as const, id: existing.id as string };
  }
  const id = crypto.randomUUID();
  const { error } = await supabase.from("folio_files").insert({ id, paper_id: paperId, path, kind: "binary", storage_key, size_bytes: size, content_hash: hash });
  return error ? { ok: false as const, error: "failed" } : { ok: true as const, id };
}

export async function deleteFolioFile(paperId: string, fileId: string) {
  const { supabase } = await me();
  const { data: f } = await supabase.from("folio_files").select("storage_key").eq("id", fileId).eq("paper_id", paperId).maybeSingle();
  if (f?.storage_key) await supabase.storage.from("folio").remove([f.storage_key]);
  const { error } = await supabase.from("folio_files").delete().eq("id", fileId).eq("paper_id", paperId);
  return { ok: !error };
}

export async function renameFolioFile(paperId: string, fileId: string, path: string) {
  const { supabase } = await me();
  if (!okPath(path)) return { ok: false, error: "bad_path" };
  const { error } = await supabase.from("folio_files").update({ path }).eq("id", fileId).eq("paper_id", paperId).eq("kind", "text");
  return { ok: !error, error: error?.code === "23505" ? "exists" : error ? "failed" : undefined };
}

export async function setFolioMainFile(paperId: string, path: string) {
  const { supabase } = await me();
  if (!okPath(path) || !path.endsWith(".tex")) return { ok: false };
  const { error } = await supabase.from("folio_papers").update({ main_file: path }).eq("id", paperId);
  return { ok: !error };
}
