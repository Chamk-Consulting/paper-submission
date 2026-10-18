import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/config/site";

/**
 * Secret-key client: BYPASSES row-level security.
 * Only for system work (hooks, cron, webhooks). Never import from client code,
 * and log every use to audit_log.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SECRET_KEY (server-only)");
  return createClient(supabaseEnv.url(), secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
