import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, negotiate } from "@/lib/i18n/config";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";

// Thin edge layer: pick the language, refresh the Supabase session, keep signed-out users out of
// private areas. Real permission checks live in server actions and RLS.
const PROTECTED_PREFIXES = ["/workspace", "/submissions", "/submit", "/manage", "/reviews", "/settings", "/inbox", "/chair", "/search", "/admin"];
const AUTH_PAGES = ["/sign-in", "/sign-up", "/create-account"];
const TWO_STEP_GUARDED = [...PROTECTED_PREFIXES, "/create-account/password", "/create-account/profile", "/welcome"];
// Registration gate (plan B7): an account with an unfinished step (password or profile, kept in the session token as
// user_metadata.onb by /auth/continue) is sent to that step first, then back to the page it asked for.
const ONBOARDING_GUARDED = [...PROTECTED_PREFIXES, "/welcome"];
// Route handlers live outside app/[lang] and are never rewritten.
const NO_LOCALE = [/^\/(?:robots\.txt|sitemap\.xml)$/, /^\/api\//, /^\/feed\//, /^\/auth\//, /^\/sign-up$/, /^\/venues\/[^/]+\/calendar\.ics$/, /^\/submissions\/[^/]+\/receipt\.pdf$/];

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const first = pathname.split("/")[1];
  const explicit = isLocale(first) ? first : null;
  const bare = explicit ? pathname.slice(first.length + 1) || "/" : pathname;
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = explicit ?? (isLocale(cookieLocale) ? cookieLocale : negotiate(request.headers.get("accept-language")));
  const skipLocale = NO_LOCALE.some((r) => r.test(bare));

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

  // Visible URLs stay unprefixed (/venues); the page renders from /[lang]/venues. /fr/venues also works and is remembered.
  const target = request.nextUrl.clone();
  if (!skipLocale && !explicit) target.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  const make = () => (skipLocale || explicit ? NextResponse.next({ request }) : NextResponse.rewrite(target, { request }));
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
  if (user && AUTH_PAGES.includes(bare)) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}/workspace`;
    url.search = "";
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
