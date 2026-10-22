import type { NextRequest } from "next/server";

// Live "has this password leaked?" check for the password forms. The browser hashes the password (SHA-1) and
// sends only the first 5 characters of the hash; this returns every leaked hash suffix starting with them
// (Have I Been Pwned range API, padded), and the browser looks for its own suffix. The password never leaves
// the browser. Fails quietly: an empty list means "couldn't check", and the server checks again on save.
export async function GET(req: NextRequest) {
  const p = (req.nextUrl.searchParams.get("p") ?? "").toUpperCase();
  if (!/^[0-9A-F]{5}$/.test(p)) return new Response("", { status: 400 });
  try {
    const r = await fetch(`https://api.pwnedpasswords.com/range/${p}`, {
      headers: { "Add-Padding": "true", "User-Agent": "Plenary" }, signal: AbortSignal.timeout(2500), cache: "no-store",
    });
    if (!r.ok) return new Response("", { status: 503 });
    return new Response(await r.text(), { headers: { "content-type": "text/plain", "cache-control": "public, max-age=86400" } });
  } catch {
    return new Response("", { status: 503 });
  }
}
