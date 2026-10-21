import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The signed-in person's own row, every column. Goes through rpc("my_person") because lock, deletion and
 * availability columns are not readable directly. Falls back to a plain read on a database that doesn't
 * have the function yet.
 */
export async function readMyPerson(supabase: SupabaseClient, userId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc("my_person");
  if (!error) return (data as Record<string, unknown> | null) ?? null;
  if (error.code !== "PGRST202" && error.code !== "42883") return null;
  const { data: row } = await supabase.from("persons").select("*").eq("user_id", userId).maybeSingle();
  return (row as Record<string, unknown> | null) ?? null;
}
