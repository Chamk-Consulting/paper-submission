import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/config/site";

/**
 * Client for Server Components, Server Actions and Route Handlers.
 * Acts as the signed-in user, so row-level security applies.
 */
export async function createClient() {
  // Per-request data: the Supabase client reads the clock (token expiry), which Next.js refuses while it prepares
  // a page ahead of time ("Date.now() while prerendering"). Marking the request first makes everything after it live.
  await connection();
  const cookieStore = await cookies();
  return createServerClient(supabaseEnv.url(), supabaseEnv.publishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there.
          // proxy.ts refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/** Verified identity from the auth server — never trust getSession() alone on the server. */
export async function getUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
