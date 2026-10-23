import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/*
 * The product name shown to people, read from the database (platform_settings.brand_name, via public.brand_name()).
 * Every translated string swaps "Plenary" for it (lib/i18n/t-core.ts), and the few places that don't go through
 * translation (PDFs, calendar feeds, the confirm page, the manifest) call getBrand(). Changing the name is one
 * database update; it shows within a few minutes. Internal names (plenary_id, PL- IDs, code) don't change.
 */

export const BASE_BRAND = "Plenary";

export async function getBrand(): Promise<string> {
  "use cache";
  cacheLife("minutes");
  cacheTag("brand");
  try {
    const { data, error } = await createPublicClient().rpc("brand_name");
    const name = !error && typeof data === "string" ? data.trim() : "";
    return name.length >= 2 ? name : BASE_BRAND;
  } catch {
    return BASE_BRAND;
  }
}
