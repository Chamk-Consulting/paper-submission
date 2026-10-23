"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/* Review-polish actions: volunteering (SB08), reviewer → editor message (RV02), annotated PDF (RV03).
   Messages are English keys, translated by the forms. */

export type PolishState = { error?: string; ok?: boolean; fieldErrors?: Record<string, string> };

const MSG = {
  bad: "Something went wrong. Please try again.",
  notAllowed: "You can't do that on this review any more.",
  body: "Write your message.",
  noEditor: "There is no editor to message yet. Try again once the paper has an associate editor.",
  path: "Upload a PDF first.",
  signIn: "Sign in again to continue.",
};

const uuid = z.guid();
const friendly = (m?: string) => {
  if (!m) return MSG.bad;
  if (/no editor/i.test(m)) return MSG.noEditor;
  if (/sign in/i.test(m)) return MSG.signIn;
  if (/upload the file|bad path/i.test(m)) return MSG.path;
  if (/not allowed|42501|row-level/i.test(m)) return MSG.notAllowed;
  return MSG.bad;
};

/* ---------------------------------------------------------------- SB08 volunteer to review */
const volZ = z.object({
  venueId: uuid,
  topics: z.string().max(1200).optional(),
  note: z.string().trim().max(500).optional(),
  max: z.coerce.number().int().min(1).max(10).default(3),
  path: z.string().max(300).optional(),
});

export async function volunteer(_: PolishState, fd: FormData): Promise<PolishState> {
  const p = volZ.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: MSG.bad };
  const topics = (p.data.topics ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
  const supabase = await createClient();
  const { error } = await supabase.rpc("volunteer_to_review", { p_venue: p.data.venueId, p_topics: topics, p_note: p.data.note || null, p_max: p.data.max });
  if (error) return { error: friendly(error.message) };
  if (p.data.path?.startsWith("/")) revalidatePath(p.data.path);
  return { ok: true };
}

export async function withdrawVolunteer(_: PolishState, fd: FormData): Promise<PolishState> {
  const venueId = uuid.safeParse(fd.get("venueId"));
  if (!venueId.success) return { error: MSG.bad };
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_volunteering", { p_venue: venueId.data });
  if (error) return { error: friendly(error.message) };
  const path = String(fd.get("path") ?? "");
  if (path.startsWith("/")) revalidatePath(path);
  return { ok: true };
}

/* ---------------------------------------------------------------- RV02 message the associate editor */
const msgZ = z.object({ assignmentId: uuid, subject: z.string().trim().max(200).optional(), body: z.string().trim().min(2, MSG.body).max(8000) });

export async function messageEditor(_: PolishState, fd: FormData): Promise<PolishState> {
  const p = msgZ.safeParse(Object.fromEntries(fd));
  if (!p.success) {
    const f = p.error.flatten().fieldErrors;
    return f.body ? { fieldErrors: { body: MSG.body } } : { error: MSG.bad };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("message_handling_editor", { p_assignment: p.data.assignmentId, p_subject: p.data.subject ?? "", p_body: p.data.body });
  if (error) return { error: friendly(error.message) };
  redirect(`/workspace/inbox/${data as string}`);
}

/* ---------------------------------------------------------------- RV03 annotated PDF (file is uploaded from the browser first) */
export async function setAnnotation(assignmentId: string, path: string | null): Promise<PolishState> {
  if (!uuid.safeParse(assignmentId).success || (path !== null && (path.length > 400 || !path.toLowerCase().endsWith(".pdf")))) return { error: MSG.bad };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_annotated_pdf", { p_assignment: assignmentId, p_path: path });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/workspace/reviews/${assignmentId}`);
  return { ok: true };
}
