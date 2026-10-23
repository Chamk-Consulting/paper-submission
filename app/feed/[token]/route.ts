import { createPublicClient } from "@/lib/supabase/public";
import { hashToken } from "@/lib/tokens";
import { buildIcs, type IcsItem } from "@/lib/account/ics";
import { site } from "@/lib/config/site";
import { getBrand } from "@/lib/config/brand";

/*
 * CL01 live feed: /feed/<token>.ics. No sign-in — the unguessable token is the key; only its hash is stored.
 * An unknown or replaced token returns an empty calendar, so a stale subscription quietly empties
 * and nobody can tell valid tokens from invalid ones.
 */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const brand = await getBrand();
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return new Response("Not found", { status: 404 });
  const { data, error } = await createPublicClient().rpc("calendar_feed_items", { p_token_hash: hashToken(token) });
  if (error) return new Response("Feed unavailable", { status: 503, headers: { "retry-after": "600" } });
  const body = buildIcs((data ?? []) as IcsItem[], { name: `${brand} deadlines`, origin: site.url, host: new URL(site.url).host });
  return new Response(body, {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=900", "x-robots-tag": "noindex" },
  });
}
