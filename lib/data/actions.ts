"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/* ST05 — keep the account: cancels a scheduled deletion (only your own, only while it is still scheduled). */
export async function cancelDeletion(id: string): Promise<{ ok?: boolean; error?: string }> {
  if (!z.guid().safeParse(id).success) return { error: "Something went wrong. Please try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_deletion", { p_id: id });
  if (error) return { error: /nothing to cancel/i.test(error.message) ? "This deletion can no longer be cancelled." : "Something went wrong. Please try again." };
  revalidatePath("/[lang]/settings/privacy", "page");
  revalidatePath("/[lang]/settings/privacy/export", "page");
  return { ok: true };
}
