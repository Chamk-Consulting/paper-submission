import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Daily job (Vercel cron): runs account deletions that are due and removes expired export files.
 * Needs CRON_SECRET (Vercel sends it as a Bearer token) and SUPABASE_SECRET_KEY — both set in the Vercel dashboard only.
 */
export const maxDuration = 60;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: "not_configured" }, 503);
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  if (!process.env.SUPABASE_SECRET_KEY) return json({ error: "not_configured" }, 503);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("run_due_data_requests");
  if (error) return json({ error: "failed" }, 500);
  const r = data as { deleted: number; blocked: number; expired_files: string[] };
  let removed = 0;
  for (let i = 0; i < r.expired_files.length; i += 100) {
    const { data: gone } = await admin.storage.from("exports").remove(r.expired_files.slice(i, i + 100));
    removed += gone?.length ?? 0;
  }
  return json({ deleted: r.deleted, blocked: r.blocked, exports_removed: removed });
}
