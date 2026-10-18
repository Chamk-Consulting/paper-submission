import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/config/site";

/** Cookie-less anonymous client for cacheable public data (published venues, programs). RLS applies as `anon`. */
export function createPublicClient() {
  return createClient(supabaseEnv.url(), supabaseEnv.publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
