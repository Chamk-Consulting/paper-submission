import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { START_HREF, parseUi } from "@/lib/account/ui-prefs";

/** Settings › Preferences › Start page: used after sign-in only when no particular page was asked for. */
export async function withStartPage(supabase: SupabaseClient, next: string): Promise<string> {
  if (next !== "/workspace") return next;
  const { data } = await supabase.rpc("my_person");
  return START_HREF[parseUi((data as { ui_prefs?: unknown } | null)?.ui_prefs).start];
}
