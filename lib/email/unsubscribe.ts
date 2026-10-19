import "server-only";
import { newToken } from "@/lib/tokens";
import { absUrl } from "@/lib/email/send";
import { createClient } from "@/lib/supabase/server";

/*
 * UN01 unsubscribe links. Each link carries a random token; only its sha256 hash is stored
 * (public.email_unsub_tokens), so a leaked database never yields working links.
 * Issuing needs a signed-in organizer/AE of the venue (or the person themself, without a venue).
 */
export type UnsubKind = "announcements" | "review_invitations";

/** Links for many people at once (one database call per 500). People whose link could not be stored get none. */
export async function unsubscribeUrls(venueId: string | null, personIds: string[], kind: UnsubKind = "announcements"): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(personIds)];
  if (!ids.length) return out;
  const supabase = await createClient();
  for (let i = 0; i < ids.length; i += 500) {
    const batch = ids.slice(i, i + 500).map((person_id) => ({ person_id, ...newToken() }));
    const { error } = await supabase.rpc("issue_unsub_tokens", {
      p_venue: venueId,
      p_items: batch.map((b) => ({ person_id: b.person_id, token_hash: b.hash, category: kind })),
    });
    if (error) continue; // the mail still goes out, just without the link
    for (const b of batch) out.set(b.person_id, absUrl(`/unsubscribe/${b.token}`));
  }
  return out;
}

export async function unsubscribeUrl(personId: string, venueId: string | null, kind: UnsubKind = "announcements"): Promise<string | null> {
  return (await unsubscribeUrls(venueId, [personId], kind)).get(personId) ?? null;
}

/** RFC 8058 one-click endpoint for the List-Unsubscribe header (POST, no page). */
export const oneClickUrl = (pageUrl: string) => pageUrl.replace("/unsubscribe/", "/api/unsubscribe/");

/** Tokens are 24 random bytes in base64url. */
export const isUnsubToken = (t: string) => /^[A-Za-z0-9_-]{32}$/.test(t);
