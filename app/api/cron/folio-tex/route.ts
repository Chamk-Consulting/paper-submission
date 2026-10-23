import { Sandbox, Snapshot } from "@vercel/sandbox";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Daily, Vercel cron: keeps the TeX Live snapshot that Folio builds start from alive.
 * Snapshots made from the dashboard or API expire after 7 days by default; when the current one has an
 * expiry date, this makes a copy that never expires and records it in folio_settings ('tex_snapshot').
 * Needs CRON_SECRET and SUPABASE_SECRET_KEY (Vercel dashboard only).
 */
export const maxDuration = 300;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: "not_configured" }, 503);
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return json({ error: "unauthorized" }, 401);
  const admin = createAdminClient();
  const { data: row } = await admin.from("folio_settings").select("value").eq("key", "tex_snapshot").maybeSingle();
  const current = row?.value ?? process.env.FOLIO_TEX_SNAPSHOT;
  if (!current) return json({ error: "no_snapshot" }, 503);
  const snap = await Snapshot.get({ snapshotId: current });
  if (!snap.expiresAt) return json({ ok: true, snapshot: current, expires: null });

  const sb = await Sandbox.create({ source: { type: "snapshot", snapshotId: current }, persistent: false, timeout: 10 * 60 * 1000, networkPolicy: "deny-all" });
  const copy = await sb.snapshot({ expiration: 0 });
  await admin.from("folio_settings").upsert({ key: "tex_snapshot", value: copy.snapshotId, updated_at: new Date().toISOString() });
  return json({ ok: true, snapshot: copy.snapshotId, replaced: current });
}
