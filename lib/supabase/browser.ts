import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/config/site";

/** Client for Client Components. Uses the publishable key; RLS applies. */
export function createClient() {
  return createBrowserClient(supabaseEnv.url(), supabaseEnv.publishableKey());
}
