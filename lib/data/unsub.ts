"use server";

import { hashToken } from "@/lib/tokens";
import { createPublicClient } from "@/lib/supabase/public";
import { isUnsubToken } from "@/lib/email/unsubscribe";

/* UN01 — anyone holding the link can change these, without signing in. The database checks the token hash. */

export type UnsubInfo = {
  venue: string | null;
  category: "announcements" | "review_invitations";
  email: string | null;
  main: boolean;
  all_announcements: boolean;
  review_invitations: boolean;
  product_news: boolean;
};
export type UnsubWhat = "main" | "all_announcements" | "review_invitations" | "product_news";

export async function getUnsubInfo(token: string): Promise<UnsubInfo | null> {
  if (!isUnsubToken(token)) return null;
  const { data, error } = await createPublicClient().rpc("unsub_info", { p_hash: hashToken(token) });
  if (error || !data) return null;
  return data as UnsubInfo;
}

export async function setUnsub(token: string, what: UnsubWhat, stop: boolean): Promise<{ info?: UnsubInfo; error?: string }> {
  if (!isUnsubToken(token) || !["main", "all_announcements", "review_invitations", "product_news"].includes(what)) return { error: "This link is not valid." };
  const { data, error } = await createPublicClient().rpc("unsub_set", { p_hash: hashToken(token), p_what: what, p_stop: !!stop });
  if (error || !data) return { error: /not valid/i.test(error?.message ?? "") ? "This link is not valid." : "Something went wrong. Please try again." };
  return { info: data as UnsubInfo };
}

/** Saves several choices at once (the "Save" button). */
export async function saveUnsub(token: string, choices: Partial<Record<Exclude<UnsubWhat, "main">, boolean>>): Promise<{ info?: UnsubInfo; error?: string }> {
  let last: { info?: UnsubInfo; error?: string } = {};
  for (const [k, v] of Object.entries(choices)) {
    last = await setUnsub(token, k as UnsubWhat, !!v);
    if (last.error) return last;
  }
  return last.info ? last : { info: (await getUnsubInfo(token)) ?? undefined };
}
