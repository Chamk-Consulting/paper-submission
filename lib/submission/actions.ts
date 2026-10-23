"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkPdf } from "@/lib/submission/pdf-check";
import { loadSubmission } from "@/lib/submission/data";
import { mdToPlain, wordCount } from "@/lib/rich-text/plain";

export type ActionState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; savedAt?: string };

const uuid = z.guid();
const friendly = (msg?: string) => {
  if (!msg) return "Something went wrong. Please try again.";
  if (/closed/i.test(msg)) return "Submissions for this venue are closed.";
  if (/cannot edit|cannot submit|permission|42501|row-level/i.test(msg)) return "You can't change this paper any more (deadline passed, withdrawn, or not your paper).";
  return msg.replace(/^.*?:\s*/, "").replace(/^\w/, (c) => c.toUpperCase());
};

async function bumpStep(id: string, step: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("submissions").select("draft_step").eq("id", id).maybeSingle();
  if (data && (data.draft_step ?? 1) < step) await supabase.from("submissions").update({ draft_step: step }).eq("id", id);
}

const go = (id: string, step: string, intent: FormDataEntryValue | null) => {
  revalidatePath(`/submissions/${id}`, "layout");
  if (intent === "exit") redirect("/workspace/submissions");
  redirect(`/submissions/${id}/${step}`);
};

/* SB01 — start a draft, or change type/track of an existing one. */
export async function saveType(_: ActionState, fd: FormData): Promise<ActionState> {
  const paperType = String(fd.get("paperType") ?? "").trim();
  const track = String(fd.get("track") ?? "").trim();
  const errs: Record<string, string> = {};
  if (!paperType) errs.paperType = "Choose what you're submitting.";
  if (!track) errs.track = "Choose a track to continue.";
  if (Object.keys(errs).length) return { fieldErrors: errs };
  const supabase = await createClient();
  const subId = String(fd.get("submissionId") ?? "");
  if (subId) {
    if (!uuid.safeParse(subId).success) return { error: "Bad request." };
    const { error } = await supabase.from("submissions").update({ paper_type: paperType, track }).eq("id", subId).select("id").single();
    if (error) return { error: friendly(error.message) };
    await bumpStep(subId, 2);
    go(subId, "details", fd.get("intent"));
  }
  const venueId = String(fd.get("venueId") ?? "");
  if (!uuid.safeParse(venueId).success) return { error: "Bad request." };
  const { data, error } = await supabase.rpc("create_draft", { p_venue: venueId, p_paper_type: paperType, p_track: track });
  if (error || !data) return { error: friendly(error?.message) };
  go(data as string, "details", fd.get("intent"));
  return {};
}

/* SB02 — details + declarations. */
const detailsSchema = z.object({
  title: z.string().trim().refine((s) => mdToPlain(s).length >= 10, "Enter the full title (at least 10 characters).").refine((s) => s.length <= 200, "200 characters at most."),
  abstract: z.string().trim().min(1, "Enter the abstract.").refine((s) => wordCount(s) <= 250, "250 words at most."),
  shortTitle: z.string().trim().max(120).optional(),
});
export async function saveDetails(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("submissionId") ?? "");
  if (!uuid.safeParse(id).success) return { error: "Bad request." };
  const intent = fd.get("intent");
  const parsed = detailsSchema.safeParse({ title: fd.get("title"), abstract: fd.get("abstract"), shortTitle: fd.get("shortTitle") || undefined });
  const original = fd.get("original") === "on";
  const draftOnly = intent === "exit";
  if (!draftOnly) {
    const errs: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
    if (!original) errs.original = "Please confirm to continue.";
    if (Object.keys(errs).length) return { fieldErrors: errs };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("submissions").update({
    title: String(fd.get("title") ?? "").trim().slice(0, 200) || "Untitled paper",
    abstract: String(fd.get("abstract") ?? "").trim().slice(0, 4000) || null,
    short_title: String(fd.get("shortTitle") ?? "").trim().slice(0, 120) || null,
    declarations: { original, preprint: fd.get("preprint") === "on", student_award: fd.get("studentAward") === "on" },
  }).eq("id", id).select("id").single();
  if (error) return { error: friendly(error.message) };
  if (!draftOnly) await bumpStep(id, 3);
  go(id, "authors", intent);
  return {};
}

/* SB03 — authors. */
export async function lookupPerson(query: string): Promise<{ found?: { personId: string; name: string; institution: string | null; plenaryId: string | null }; error?: string }> {
  const q = query.trim();
  if (!q) return { error: "Enter an email or Plenary ID." };
  if (/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(q)) return { error: "Adding by ORCID iD isn't available yet — use their email." }; // TODO(orcid)
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_person", { p_query: q });
  if (error) return { error: friendly(error.message) };
  const r = (data as Record<string, unknown>[] | null)?.[0];
  if (!r) return {};
  // Found by email: only initials come back (no harvesting names), so show the email they typed with the initials.
  const byEmail = q.includes("@");
  const name = byEmail ? `${q.toLowerCase()}${r.display_name ? ` (${r.display_name as string})` : ""}` : (r.display_name as string) || q;
  return { found: { personId: r.person_id as string, name, institution: (r.institution as string) ?? null, plenaryId: (r.plenary_id as string) ?? null } };
}

const authorItem = z.union([
  z.object({ personId: z.guid(), corresponding: z.boolean() }),
  z.object({ email: z.string().email(), givenName: z.string().max(120), familyName: z.string().max(120), institution: z.string().max(200).optional(), corresponding: z.boolean() }),
]);
export async function saveAuthors(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("submissionId") ?? "");
  if (!uuid.safeParse(id).success) return { error: "Bad request." };
  let list: unknown;
  try { list = JSON.parse(String(fd.get("authors") ?? "[]")); } catch { return { error: "Bad request." }; }
  const parsed = z.array(authorItem).min(1).max(40).safeParse(list);
  if (!parsed.success) return { error: "Check the author list: each new co-author needs an email and a name." };
  const payload = parsed.data.map((a) => ("personId" in a ? { person_id: a.personId, corresponding: a.corresponding } : { email: a.email, given_name: a.givenName, family_name: a.familyName, institution: a.institution, corresponding: a.corresponding }));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_authors", { p_submission: id, p_authors: payload });
  if (error) return { error: friendly(error.message) };
  if (fd.get("intent") !== "exit") await bumpStep(id, 4);
  go(id, "keywords", fd.get("intent"));
  return {};
}

/* SB04 — keywords. */
export async function saveKeywords(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("submissionId") ?? "");
  if (!uuid.safeParse(id).success) return { error: "Bad request." };
  const keywords = fd.getAll("keyword").map(String).filter(Boolean).slice(0, 5);
  const own = String(fd.get("own") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5).map((s) => s.slice(0, 60));
  const intent = fd.get("intent");
  if (intent !== "exit" && keywords.length < 3) return { fieldErrors: { keywords: "Pick at least 3 keywords from the list." } };
  const supabase = await createClient();
  const { error } = await supabase.from("submissions").update({ keywords, own_keywords: own }).eq("id", id).select("id").single();
  if (error) return { error: friendly(error.message) };
  if (intent !== "exit") await bumpStep(id, 5);
  go(id, "files", intent);
  return {};
}

/* SB05 — after the browser uploads to Storage: check the PDF and record the file. */
const ROLES = ["paper", "appendix", "source", "data", "video"] as const;
export async function finishUpload(input: { submissionId: string; role: (typeof ROLES)[number]; path: string; name: string; size: number; mime: string }): Promise<{ error?: string; status?: string }> {
  if (!uuid.safeParse(input.submissionId).success || !ROLES.includes(input.role) || !input.path.startsWith(`${input.submissionId}/`)) return { error: "Bad request." };
  const ctx = await loadSubmission(input.submissionId);
  if (!ctx?.editable) return { error: "You can't change this paper any more." };
  const supabase = await createClient();
  let pages: number | null = null;
  let check: Record<string, unknown> = {};
  if (input.role === "paper" || input.mime === "application/pdf") {
    const { data: blob, error } = await supabase.storage.from("papers").download(input.path);
    if (error || !blob) return { error: "We couldn't read the uploaded file. Try again." };
    const type = ctx.venue.details.types?.find((t) => t.name === ctx.sub.paperType);
    const result = await checkPdf(new Uint8Array(await blob.arrayBuffer()), {
      pageLimit: type?.length ?? ctx.venue.pageLimit,
      doubleBlind: ctx.venue.doubleBlind,
      names: ctx.authors.flatMap((a) => a.name.split(/\s+/).filter((p) => p.length >= 4)),
      institutions: ctx.authors.map((a) => a.institution ?? "").filter(Boolean),
    });
    pages = result.pages;
    check = result;
  }
  const { error } = await supabase.rpc("record_submission_file", {
    p_submission: input.submissionId, p_role: input.role, p_path: input.path, p_name: input.name.slice(0, 200), p_size: input.size, p_mime: input.mime, p_pages: pages, p_check: check,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/submissions/${input.submissionId}`, "layout");
  return { status: (check.status as string) ?? "recorded" };
}

export async function removeFile(fileId: string, submissionId: string): Promise<{ error?: string }> {
  if (!uuid.safeParse(fileId).success) return { error: "Bad request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_submission_file", { p_file: fileId });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/submissions/${submissionId}`, "layout");
  return {};
}

export async function fileUrl(path: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("papers").createSignedUrl(path, 300);
  return error || !data ? { error: "Couldn't open the file." } : { url: data.signedUrl };
}

export async function continueFromFiles(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("submissionId") ?? "");
  const ctx = await loadSubmission(id);
  if (!ctx) return { error: "Bad request." };
  if (fd.get("intent") !== "exit") {
    if (!ctx.done.files) return { error: "Upload a PDF that passes the checks to continue." };
    await bumpStep(id, 6);
  }
  go(id, "conflicts", fd.get("intent"));
  return {};
}

/* SB06 — conflicts. */
const conflictItem = z.object({ personId: z.guid().nullable(), institution: z.string().max(200).nullable(), reason: z.string().max(200) });
export async function saveConflicts(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("submissionId") ?? "");
  if (!uuid.safeParse(id).success) return { error: "Bad request." };
  let list: unknown;
  try { list = JSON.parse(String(fd.get("conflicts") ?? "[]")); } catch { return { error: "Bad request." }; }
  const parsed = z.array(conflictItem).max(60).safeParse(list);
  if (!parsed.success) return { error: "Bad request." };
  if (parsed.data.some((c) => c.reason.trim().length < 2)) return { error: "Add a reason for each conflict." };
  const supabase = await createClient();
  const del = await supabase.from("submission_conflicts").delete().eq("submission_id", id);
  if (del.error) return { error: friendly(del.error.message) };
  if (parsed.data.length) {
    const { error } = await supabase.from("submission_conflicts").insert(parsed.data.map((c) => ({ submission_id: id, person_id: c.personId, institution: c.institution, reason: c.reason.trim() })));
    if (error) return { error: friendly(error.message) };
  }
  const { error } = await supabase.from("submissions").update({ conflicts_ok_at: new Date().toISOString() }).eq("id", id).select("id").single();
  if (error) return { error: friendly(error.message) };
  if (fd.get("intent") !== "exit") await bumpStep(id, 7);
  go(id, "review", fd.get("intent"));
  return {};
}

/* SB07 — submit. */
export async function submitPaper(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("submissionId") ?? "");
  if (!uuid.safeParse(id).success) return { error: "Bad request." };
  const agree = fd.get("agree") === "on", present = fd.get("present") === "on";
  if (!agree || !present) return { error: "Tick both boxes to submit." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_paper", { p_submission: id, p_agree: agree, p_present: present });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/workspace", "layout");
  revalidatePath(`/submissions/${id}`, "layout");
  redirect(`/submissions/${id}/submitted`);
}

/** Delete a draft the person started (never a submitted paper). */
export async function deleteDraft(id: string): Promise<{ error?: string }> {
  if (!uuid.safeParse(id).success) return { error: "Bad request." };
  const supabase = await createClient();
  // Files first, through Storage (SQL can't delete storage rows). Only the draft's author may: papers_delete policy.
  const { data: draft } = await supabase.from("submissions").select("id, stage").eq("id", id).maybeSingle();
  if (!draft) return { error: "Only the person who started this draft can delete it." };
  if (draft.stage !== "draft") return { error: "Only drafts can be deleted — withdraw a submitted paper instead." };
  const { data: listed } = await supabase.storage.from("papers").list(id, { limit: 1000 });
  const { data: rows } = await supabase.from("submission_files").select("storage_path").eq("submission_id", id);
  const paths = [...new Set([
    ...((listed ?? []) as { name: string }[]).map((f) => `${id}/${f.name}`),
    ...((rows ?? []) as { storage_path: string | null }[]).map((f) => f.storage_path).filter((p): p is string => !!p),
  ])];
  if (paths.length) await supabase.storage.from("papers").remove(paths);
  const { error } = await supabase.rpc("delete_draft", { p_submission: id });
  if (error) {
    if (/function .*delete_draft|does not exist|PGRST202/i.test(error.message)) return { error: "Deleting drafts needs the latest database update." };
    if (/only drafts/i.test(error.message)) return { error: "Only drafts can be deleted — withdraw a submitted paper instead." };
    if (/not your draft/i.test(error.message)) return { error: "Only the person who started this draft can delete it." };
    return { error: friendly(error.message) };
  }
  revalidatePath("/workspace/submissions");
  redirect("/workspace/submissions");
}
