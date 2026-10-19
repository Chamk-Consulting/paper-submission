"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { friendlyDb, venueIdBySlug } from "@/lib/manage/actions-util";

/* EM13 test submission + EM40 view as. Messages are English keys, translated by the client. */

const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/);
const uuid = z.string().uuid();

/** Create a test paper as myself and open the author wizard on it. */
export async function startTestSubmission(slug: string): Promise<{ error?: string }> {
  if (!slugSchema.safeParse(slug).success) return { error: "Bad request." };
  const venueId = await venueIdBySlug(slug);
  if (!venueId) return { error: "Event not found." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_test_submission", { p_venue: venueId });
  if (error) return { error: /3 at most/.test(error.message) ? "Delete an old test paper first (3 at most)." : friendlyDb(error.message) };
  redirect(`/submissions/${data as string}/details`);
}

/** Delete a test paper: its files first (with my own session — I'm its author), then the row. */
export async function deleteTestSubmission(slug: string, id: string): Promise<{ error?: string; ok?: boolean }> {
  if (!slugSchema.safeParse(slug).success || !uuid.safeParse(id).success) return { error: "Bad request." };
  const supabase = await createClient();
  const { data: sub } = await supabase.from("submissions").select("id, is_test").eq("id", id).maybeSingle();
  if (!sub?.is_test) return { error: "Only test papers can be deleted here." };
  const { data: files } = await supabase.from("submission_files").select("storage_path").eq("submission_id", id);
  const paths = ((files ?? []) as { storage_path: string }[]).map((f) => f.storage_path);
  if (paths.length) await supabase.storage.from("papers").remove(paths);
  const { error } = await supabase.rpc("delete_test_submission", { p_submission: id });
  if (error) return { error: friendlyDb(error.message) };
  revalidatePath(`/[lang]/manage/${slug}/setup/go-live`, "page");
  revalidatePath("/[lang]/workspace/submissions", "page");
  return { ok: true };
}

/** EM40 — start/stop a read-only "view as" session (audit log + view_as_sessions, A6). */
export async function viewAsEvent(slug: string, person: string, action: "start" | "stop"): Promise<{ error?: string }> {
  if (!slugSchema.safeParse(slug).success || !uuid.safeParse(person).success) return { error: "Bad request." };
  const venueId = await venueIdBySlug(slug);
  if (!venueId) return { error: "Event not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_organizer_event", {
    p_venue: venueId, p_action: action === "start" ? "view_as.started" : "view_as.ended", p_details: { person },
  });
  return error ? { error: friendlyDb(error.message) } : {};
}
