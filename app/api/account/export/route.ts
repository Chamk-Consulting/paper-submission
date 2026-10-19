import { createClient } from "@/lib/supabase/server";
import { buildExport } from "@/lib/data/export";

/* ST05 — make an export now (synchronous; a typical account is a few MB). The ZIP is fetched later via /api/account/export/[id]. */

export const maxDuration = 60;
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "sign_in" }, 401);
  const { data: person } = await supabase.from("persons").select("id").eq("user_id", user.id).maybeSingle();
  if (!person) return json({ error: "no_profile" }, 400);

  const { data: id, error } = await supabase.rpc("start_export");
  if (error || !id) return json({ error: /too many/i.test(error?.message ?? "") ? "limit" : "failed" }, /too many/i.test(error?.message ?? "") ? 429 : 500);
  try {
    const r = await buildExport(supabase, person.id as string, id as string);
    const { error: e2 } = await supabase.rpc("finish_export", { p_id: id, p_path: r.path, p_bytes: r.bytes, p_note: { files_included: r.included, files_skipped: r.skipped } });
    if (e2) throw new Error(e2.message);
    return json({ ok: true, id, bytes: r.bytes });
  } catch (e) {
    await supabase.rpc("fail_export", { p_id: id, p_reason: e instanceof Error ? e.message.slice(0, 200) : "export failed" });
    return json({ error: "failed" }, 500);
  }
}
