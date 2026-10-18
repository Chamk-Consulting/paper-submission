import "server-only";
import { cacheLife } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/** Published venue by slug, for "You're signing in to submit to …" banners. */
export async function getPublishedVenue(slug: string | undefined | null) {
  "use cache";
  cacheLife("minutes");
  if (!slug || !/^[a-z0-9-]{3,64}$/.test(slug)) return null;
  const { data } = await createPublicClient()
    .from("venues")
    .select("slug, name, short_name, location")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return data;
}
