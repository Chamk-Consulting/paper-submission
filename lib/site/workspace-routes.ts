/*
 * Signed-in people never see a public page or a sign-in page: proxy.ts sends each address below to its workspace
 * version. Visitors (and search engines) keep the public pages unchanged at the same addresses.
 *
 * Not listed, so they keep working while signed in, because each is a step someone is in the middle of:
 * /sign-in/two-step, /create-account/{verify,password,profile}, /welcome, /reset-password, /email-verified,
 * /account-help/{claim,merge,lost-email}, /invite/*, /unsubscribe/*, /auth/*, /expired, /no-access, /maintenance,
 * /offline and the print pages.
 */
const SIGN_IN_PAGES = new Set(["/sign-in", "/sign-up", "/create-account", "/forgot-password", "/forgot-password/code", "/check-email", "/auth-error"]);
const LEGAL = /^\/legal\/(privacy|terms|cookies|accessibility|security)$/;

/** The workspace address for a public or sign-in address, or null when the page stays as it is. */
export function workspaceFor(bare: string): string | null {
  if (bare === "/" || bare === "/organizers" || bare === "/pricing") return "/workspace";
  if (SIGN_IN_PAGES.has(bare)) return "/workspace";
  if (bare === "/account-help") return "/workspace/help";
  if (bare === "/venues") return "/workspace/events";
  let m = bare.match(/^\/venues\/([^/]+)(\/archive)?$/);
  if (m) return `/workspace/events/${m[1]}${m[2] ?? ""}`;
  m = bare.match(/^\/program\/([^/]+)(\/my-schedule|\/papers\/[^/]+|\/sessions\/[^/]+)?$/);
  if (m) return `/workspace/events/${m[1]}/program${m[2] ?? ""}`;
  if (bare === "/help" || bare === "/help/reviewers" || /^\/help\/reviewers\/[^/]+$/.test(bare)) return `/workspace${bare}`;
  if (bare === "/contact") return "/workspace/support";
  if (bare === "/contact/sent") return "/workspace/support/sent";
  m = bare.match(LEGAL);
  if (m) return `/workspace/legal/${m[1]}`;
  return null;
}
