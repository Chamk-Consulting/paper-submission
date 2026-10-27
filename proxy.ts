import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, negotiate } from "@/lib/i18n/config";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { movedTo, workspaceFor } from "@/lib/site/workspace-routes";
import { DEFAULT_FLAGS, parseFlags, type SiteFlags } from "@/lib/config/site-flags-core";

// Thin edge layer: pick the language, refresh the Supabase session, keep signed-out users out of
// private areas. Real permission checks live in server actions and RLS.
const PROTECTED_PREFIXES = ["/workspace", "/folio", "/submissions", "/submit", "/manage", "/reviews", "/settings", "/inbox", "/chair", "/search", "/admin"];
const AUTH_PAGES = ["/sign-in", "/sign-up", "/create-account"];
const TWO_STEP_GUARDED = [...PROTECTED_PREFIXES, "/create-account/password", "/create-account/profile", "/welcome"];
// Registration gate (plan B7): an account with an unfinished step (password or profile, kept in the session token as
// user_metadata.onb by /auth/continue) is sent to that step first, then back to the page it asked for.
const ONBOARDING_GUARDED = [...PROTECTED_PREFIXES, "/welcome"];
// Route handlers live outside app/[lang] and are never rewritten.
const NO_LOCALE = [/^\/(?:robots\.txt|sitemap\.xml)$/, /^\/api\//, /^\/feed\//, /^\/auth\//, /^\/sign-up$/, /^\/venues\/[^/]+\/calendar\.ics$/, /^\/submissions\/[^/]+\/(?:receipt|decision-letter)\.pdf$/];

// Site switches (lib/config/site-flags.ts), kept for a minute per server instance so most requests don't ask the database.
let flagsCache: { at: number; flags: SiteFlags } | null = null;
async function siteFlags(): Promise<SiteFlags> {
  if (flagsCache && Date.now() - flagsCache.at < 60_000) return flagsCache.flags;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/site_flags`, {
      method: "POST",
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(1500),
    });
    const flags = res.ok ? parseFlags(await res.json()) : flagsCache?.flags ?? DEFAULT_FLAGS;
    flagsCache = { at: Date.now(), flags };
    return flags;
  } catch {
    return flagsCache?.flags ?? DEFAULT_FLAGS;
  }
}
// Public pages that open the events list (with search) when the site runs in events-only mode.
const SINGLE_EVENT_ENTRY = new Set(["/", "/organizers", "/pricing"]);

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];
  const explicit = isLocale(first) ? first : null;
  const bare = explicit ? pathname.slice(first.length + 1) || "/" : pathname;
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = explicit ?? (isLocale(cookieLocale) ? cookieLocale : negotiate(request.headers.get("accept-language")));
  const skipLocale = NO_LOCALE.some((r) => r.test(bare));

  // Pages that moved under /workspace: one permanent redirect, whatever the language prefix.
  const moved = skipLocale ? null : movedTo(bare);
  if (moved) {
    const url = request.nextUrl.clone();
    url.pathname = `${explicit ? `/${explicit}` : ""}${moved}`;
    return NextResponse.redirect(url, 308);
  }

  // The public event page is /events/<slug> (it used to be /venues/<slug>): old links keep working.
  if (!skipLocale) {
    const old = bare.match(/^\/venues(\/[^/]+(?:\/archive)?)?$/);
    if (old) {
      const url = request.nextUrl.clone();
      url.pathname = `${explicit ? `/${explicit}` : ""}/events${old[1] ?? ""}`;
      return NextResponse.redirect(url, 308);
    }
  }

  // Supabase sends people to the Site URL (e.g. "/?code=…") when the redirect it was given isn't allow-listed.
  // Hand any auth code or token that lands outside /auth/* to the confirm route so the sign-in still completes.
  if (!bare.startsWith("/auth/")) {
    const q = request.nextUrl.searchParams;
    if ((q.has("code") && /^[0-9a-f-]{20,}$/i.test(q.get("code") ?? "")) || (q.has("token_hash") && q.has("type"))) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/confirm";
      if (!q.has("next")) url.searchParams.set("next", bare === "/" ? "/workspace" : bare);
      return NextResponse.redirect(url);
    }
  }

  // Visible URLs stay unprefixed (/events); the page renders from /[lang]/... /fr/events also works and is remembered.
  // /events/<slug> is drawn by the venue pages (app/[lang]/(site)/venues).
  const eventsPath = /^\/events(\/[^/]+(?:\/archive)?)?$/.test(bare);
  const pagePath = eventsPath ? bare.replace(/^\/events/, "/venues") : bare;
  const target = request.nextUrl.clone();
  if (!skipLocale && (!explicit || eventsPath)) target.pathname = `/${locale}${pagePath === "/" ? "" : pagePath}`;
  const make = () => (skipLocale || (explicit && !eventsPath) ? NextResponse.next({ request }) : NextResponse.rewrite(target, { request }));
  let response = make();

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = make();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });
  // getClaims checks the session token locally (signing keys) and refreshes it when it expires; it only calls
  // Supabase Auth when it has to. getUser() here was a network round trip on every click and every prefetch.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

  const prefix = explicit ? `/${explicit}` : "";
  if (!user && PROTECTED_PREFIXES.some((p) => bare === p || bare.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}/sign-in`;
    url.search = `?next=${encodeURIComponent(bare + search)}`;
    return NextResponse.redirect(url);
  }
  // Two-step sign-in: an account with an authenticator app must enter its code before private pages open.
  // The level comes from the session token itself (no network call).
  if (user && TWO_STEP_GUARDED.some((p) => bare === p || bare.startsWith(`${p}/`))) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const url = request.nextUrl.clone();
      url.pathname = `${prefix}/sign-in/two-step`;
      url.search = `?next=${encodeURIComponent(bare + search)}`;
      return NextResponse.redirect(url);
    }
  }
  const onb = (claimsData?.claims?.user_metadata as { onb?: unknown } | undefined)?.onb;
  if (user && (onb === "password" || onb === "profile")) {
    const guarded = [...ONBOARDING_GUARDED, ...(onb === "password" ? ["/create-account/profile"] : [])];
    if (guarded.some((p) => bare === p || bare.startsWith(`${p}/`))) {
      const url = request.nextUrl.clone();
      url.pathname = `${prefix}/create-account/${onb}`;
      url.search = `?next=${encodeURIComponent(bare === "/welcome" ? "/welcome" : bare + search)}`;
      return NextResponse.redirect(url);
    }
  }
  // Events-only site: the home page (and the organizer and pricing pages) open the list of all events, with search.
  if (SINGLE_EVENT_ENTRY.has(bare)) {
    const f = await siteFlags();
    if (f.singleEvent) {
      const url = request.nextUrl.clone();
      url.pathname = `${prefix}/events`;
      return NextResponse.redirect(url, 307);
    }
  }

  // Signed in: public pages and sign-in pages open their workspace version (lib/site/workspace-routes.ts).
  // A sign-in page with ?next=/somewhere goes there instead, so "sign in to continue" links still land right.
  const inWorkspace = user ? workspaceFor(bare) : null;
  if (inWorkspace) {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get("next");
    const safeNext = AUTH_PAGES.includes(bare) && next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    if (safeNext) {
      const [path, query = ""] = safeNext.split("?");
      url.pathname = `${prefix}${workspaceFor(path) ?? path}`;
      url.search = query ? `?${query}` : "";
    } else {
      url.pathname = `${prefix}${inWorkspace}`;
      if (AUTH_PAGES.includes(bare) || bare === "/forgot-password" || bare === "/forgot-password/code" || bare === "/check-email" || bare === "/auth-error") url.search = "";
    }
    return NextResponse.redirect(url);
  }

  // Language memory is a "preferences" cookie: persistent only with consent. An explicit /fr link is a
  // request for that language, so it is kept for the browser session even without consent.
  const prefs = parseConsent(request.cookies.get(CONSENT_COOKIE)?.value)?.preferences === true;
  const langCookie = { path: "/", sameSite: "lax" as const, secure: request.nextUrl.protocol === "https:", ...(prefs ? { maxAge: 31536000 } : {}) };
  if (explicit && cookieLocale !== explicit) response.cookies.set(LOCALE_COOKIE, explicit, langCookie);
  if (prefs && !explicit && !isLocale(cookieLocale) && locale !== DEFAULT_LOCALE) response.cookies.set(LOCALE_COOKIE, locale, langCookie);
  response.headers.set("Vary", "Cookie, Accept-Language");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
