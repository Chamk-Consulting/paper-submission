/* Accounts used on this device (PR03 account chooser). Shared by server and browser: no secrets, no full email. */

export const DEVICE_ACCOUNTS_KEY = "plenary.accounts"; // device storage; "plenary." keys are wiped when preferences consent is withdrawn
export const JUST_SIGNED_IN_COOKIE = "pl_just_signed_in"; // 10-minute hand-over from the server to the browser
export const MAX_DEVICE_ACCOUNTS = 3;

export type DeviceAccount = { name: string; email: string; id: string | null; at: string };

/** a.researcher@uni.edu → a.r•••@uni.edu */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  return `${user.slice(0, Math.min(3, Math.max(1, user.length - 1)))}•••@${domain}`;
}

function toB64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64Url(s: string): string {
  const p = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(p + "===".slice((p.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function valid(x: unknown): x is DeviceAccount {
  const a = x as DeviceAccount;
  return !!a && typeof a.name === "string" && typeof a.email === "string" && (a.id === null || typeof a.id === "string")
    && a.name.length <= 160 && a.email.length <= 260 && (a.id === null || /^[1-9]\d{3,8}$/.test(a.id));
}

export function encodeAccount(a: DeviceAccount): string {
  return toB64Url(JSON.stringify(a));
}

export function decodeAccount(v: string): DeviceAccount | null {
  try {
    const a = JSON.parse(fromB64Url(v));
    return valid(a) ? a : null;
  } catch {
    return null;
  }
}

export function parseAccounts(raw: string | null): DeviceAccount[] {
  try {
    const list = JSON.parse(raw ?? "[]");
    return Array.isArray(list) ? list.filter(valid).slice(0, MAX_DEVICE_ACCOUNTS) : [];
  } catch {
    return [];
  }
}

/** Newest first, one entry per person (by PIN, else masked email). */
export function mergeAccount(list: DeviceAccount[], a: DeviceAccount): DeviceAccount[] {
  const key = (x: DeviceAccount) => x.id ?? x.email;
  return [a, ...list.filter((x) => key(x) !== key(a))].slice(0, MAX_DEVICE_ACCOUNTS);
}
