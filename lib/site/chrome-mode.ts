/* URL helpers for the shared header and side menu. Which frame a page gets is decided by its route group:
   (site) header · (app) header + side menu · (auth), (bare) none. */
const LOCALE = /^\/(en|fr|it|de)(?=\/|$)/;
export const barePath = (path: string) => path.replace(LOCALE, "") || "/";

/** The event whose organiser menu shows (/manage/<slug>/…), if any. */
export function manageSlug(path: string): string | null {
  const m = barePath(path).match(/^\/manage\/([^/]+)/);
  return m && !["new", "roles"].includes(m[1]) ? m[1] : null;
}
