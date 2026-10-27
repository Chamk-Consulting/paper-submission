import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

/*
 * Site switches (platform_settings, changed by admins on the Admin page; read through public.site_flags()):
 *  - homeEvent + singleEvent: the public site is one event. "/" opens that event, the top bar hides the other public
 *    links, and the directory, organizer and pricing pages open the event instead.
 *  - signinEmailCode: "Email me a code" on the sign-in page.
 *  - signupEmailCode: new accounts confirm their email with a code first. Off: name, email and password, then in.
 */
import { DEFAULT_FLAGS, parseFlags, type SiteFlags } from "@/lib/config/site-flags-core";
export type { SiteFlags };

export async function getSiteFlags(): Promise<SiteFlags> {
  "use cache";
  cacheLife("minutes");
  cacheTag("site-flags");
  try {
    const { data, error } = await createPublicClient().rpc("site_flags");
    return error ? DEFAULT_FLAGS : parseFlags(data);
  } catch {
    return DEFAULT_FLAGS;
  }
}
