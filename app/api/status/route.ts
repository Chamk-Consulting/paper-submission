import { connection } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

/** Live system status for the footer: maintenance now, maintenance planned (next 7 days) or all working. Cached 1 minute. */
export async function GET() {
  await connection(); // live, never prerendered at build
  const now = Date.now();
  let body: { state: "ok" | "planned" | "maintenance"; startsAt?: string; endsAt?: string } = { state: "ok" };
  try {
    const { data } = await createPublicClient().from("maintenance_windows").select("starts_at, ends_at")
      .gte("ends_at", new Date(now).toISOString()).order("starts_at").limit(1);
    const w = (data as { starts_at: string; ends_at: string }[] | null)?.[0];
    if (w) {
      const s = Date.parse(w.starts_at);
      if (s <= now) body = { state: "maintenance", startsAt: w.starts_at, endsAt: w.ends_at };
      else if (s - now < 7 * 86400e3) body = { state: "planned", startsAt: w.starts_at, endsAt: w.ends_at };
    }
  } catch {
    /* unknown → shown as working; the status page has the details */
  }
  return Response.json(body, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
