/** Postgres bytea travels through PostgREST as "\\x<hex>". Shared by server and browser code. */

export function toBytea(u: Uint8Array): string {
  let s = "\\x";
  for (let i = 0; i < u.length; i++) s += u[i].toString(16).padStart(2, "0");
  return s;
}

export function fromBytea(v: string | null | undefined): Uint8Array {
  if (!v) return new Uint8Array();
  const hex = v.startsWith("\\x") ? v.slice(2) : v;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

export function toBase64(u: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b: string): Uint8Array {
  const s = atob(b);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
