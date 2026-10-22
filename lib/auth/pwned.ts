import "server-only";
import { createHash } from "node:crypto";

/**
 * Has this password appeared in a known data breach? Uses the Have I Been Pwned range API with k-anonymity:
 * only the first 5 characters of the SHA-1 hash leave the server, never the password. Fails open (network
 * trouble never blocks sign-up); Supabase "Leaked password protection" can add the same check server-side.
 */
export async function isPwnedPassword(password: string): Promise<boolean> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const r = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "Plenary" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!r.ok) return false;
    const body = await r.text();
    return body.split("\n").some((line) => {
      const [s, count] = line.trim().split(":");
      return s === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}
