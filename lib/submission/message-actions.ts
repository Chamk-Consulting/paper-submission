"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/submission/actions";

const schema = z.object({
  submissionId: z.guid(),
  subject: z.string().trim().max(300),
  body: z.string().trim().min(2, "Write your message.").max(8000, "Keep the message under 8,000 characters."),
});

/** IN02 from a paper: opens an inbox thread with the venue's chairs. */
export async function messageChairs(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) {
    const f = parsed.error.flatten().fieldErrors;
    return { fieldErrors: { ...(f.body ? { body: f.body[0] } : {}), ...(f.subject ? { subject: f.subject[0] } : {}) }, error: f.submissionId ? "Bad request." : undefined };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("message_chairs", { p_submission: parsed.data.submissionId, p_subject: parsed.data.subject, p_body: parsed.data.body });
  if (error) {
    if (/no chair/i.test(error.message)) return { error: "This venue has no chair to message yet." };
    if (/not allowed|42501/i.test(error.message + error.code)) return { error: "Only authors of this paper can message the chair." };
    return { error: "Something went wrong. Please try again." };
  }
  redirect(`/workspace/inbox/${data as string}`);
}
