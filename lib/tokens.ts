import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** A random token for an email link and the sha256 hash stored in the database (the token itself is never stored). */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
