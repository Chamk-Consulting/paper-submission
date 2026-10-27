import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { absoluteUrl, supabaseEnv } from "@/lib/config/site";

const LOCALES = ["en", "fr", "it", "de"] as const;
const PAGES = ["", "/events", "/pricing", "/organizers", "/help", "/help/reviewers", "/contact", "/legal/terms", "/legal/privacy", "/legal/cookies", "/legal/security", "/legal/accessibility"];

async function publishedVenues(): Promise<{ slug: string; updated_at: string | null }[]> {
  "use cache";
  cacheLife("hours");
  try {
    const sb = createClient(supabaseEnv.url(), supabaseEnv.publishableKey(), { auth: { persistSession: false } });
    const { data } = await sb.from("venues").select("slug, updated_at").eq("is_published", true).limit(5000);
    return (data ?? []) as { slug: string; updated_at: string | null }[];
  } catch { return []; }
}

/** sitemap.xml: public pages in every language plus every published venue. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const out: MetadataRoute.Sitemap = PAGES.map((p) => ({
    url: absoluteUrl(`/en${p}`),
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, absoluteUrl(`/${l}${p}`)])) },
  }));
  for (const v of await publishedVenues()) out.push({ url: absoluteUrl(`/en/venues/${v.slug}`), lastModified: v.updated_at ?? undefined });
  return out;
}
