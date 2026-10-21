import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { absoluteUrl, supabaseEnv } from "@/lib/config/site";

export const revalidate = 3600;

const LOCALES = ["en", "fr", "it", "de"] as const;
const PAGES = ["", "/venues", "/pricing", "/organizers", "/help", "/help/reviewers", "/contact", "/legal/terms", "/legal/privacy", "/legal/cookies", "/legal/security", "/legal/accessibility"];

/** sitemap.xml: public pages in every language plus every published venue and its program. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const out: MetadataRoute.Sitemap = [];
  for (const p of PAGES) out.push({ url: absoluteUrl(`/en${p}`), alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, absoluteUrl(`/${l}${p}`)])) } });
  try {
    const sb = createClient(supabaseEnv.url(), supabaseEnv.publishableKey(), { auth: { persistSession: false } });
    const { data } = await sb.from("venues").select("slug, updated_at").eq("is_published", true).limit(5000);
    for (const v of data ?? []) {
      out.push({ url: absoluteUrl(`/en/venues/${v.slug}`), lastModified: v.updated_at ?? undefined });
    }
  } catch { /* the static pages are still listed */ }
  return out;
}
