/** Translation core shared by server and browser. No dictionaries here, so client bundles stay small. */
export type Dict = Record<string, string>;
export type Vars = Record<string, string | number>;
export type T = (key: string, vars?: Vars) => string;

/**
 * The product name the code is written with; every translated string shows the current name instead
 * (lib/config/brand.ts). "Plenary session / talk / lecture…" is the conference term, not the product, and is kept.
 */
export const BRAND_WORD = /\bPlenary\b(?!\s+(?:sessions?|talks?|lectures?|speakers?|halls?|keynotes?|meetings?|panels?|address(?:es)?)\b)/g;
export const brandify = (s: string, brand: string) =>
  brand && brand !== "Plenary" ? s.replace(BRAND_WORD, brand).replace(/\bPLENARY\b/g, brand.toUpperCase()) : s;

export function makeTFrom(d: Dict, brand = "Plenary"): T {
  return (key, vars) => {
    let s = d[key] ?? key;
    s = brandify(s, brand);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}
