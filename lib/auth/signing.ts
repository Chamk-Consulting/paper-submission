import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Results signed by the web app and checked by the database (private.signed): extra emails and
 * PIN sign-in. The secret is PLENARY_SIGNING_SECRET in Vercel and private.app_secrets('signing')
 * in the database — the same value.
 */
export function signingReady(): boolean {
  return !!process.env.PLENARY_SIGNING_SECRET;
}

/** HMAC-SHA256 hex of `${msg}|${expires}` — matches private.signed(). */
export function sign(msg: string, expires: number): string {
  const secret = process.env.PLENARY_SIGNING_SECRET;
  if (!secret) throw new Error("Missing PLENARY_SIGNING_SECRET");
  return createHmac("sha256", secret).update(`${msg}|${expires}`).digest("hex");
}

/** Seconds since epoch, `minutes` from now (the database accepts up to 60). */
export function expiresIn(minutes: number): number {
  return Math.floor(Date.now() / 1000) + Math.min(60, minutes) * 60;
}

/** A 6-digit code. */
export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Constant-time compare of two hex strings. */
export function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
