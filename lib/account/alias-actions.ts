"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AliasState = { ok?: boolean; error?: string; info?: string; alias?: string | null };

/** Profile › Login alias: set or clear the name the person can sign in with. */
export async function saveLoginAlias(_: AliasState, fd: FormData): Promise<AliasState> {
  const raw = String(fd.get("alias") ?? "").trim().toLowerCase();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_my_login_alias", { p_alias: raw || null });
  if (error) return { error: "The alias couldn’t be saved. Try again." };
  if (data === "invalid") return { error: "Use 3–32 letters, digits, dots, dashes or underscores, starting with a letter." };
  if (data === "taken") return { error: "That alias is taken. Try another." };
  revalidatePath("/[lang]/workspace/account/profile", "page");
  return data === "cleared" ? { ok: true, info: "Alias removed.", alias: null } : { ok: true, info: "Saved. You can now sign in with this alias.", alias: raw };
}

export async function myLoginAlias(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_login_alias");
  return error || typeof data !== "string" ? null : data;
}
