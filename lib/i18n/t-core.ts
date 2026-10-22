/** Translation core shared by server and browser. No dictionaries here, so client bundles stay small. */
export type Dict = Record<string, string>;
export type Vars = Record<string, string | number>;
export type T = (key: string, vars?: Vars) => string;

export function makeTFrom(d: Dict): T {
  return (key, vars) => {
    let s = d[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}
