import { NextResponse, type NextRequest } from "next/server";
import { setUnsub } from "@/lib/data/unsub";

/** RFC 8058 one-click unsubscribe (List-Unsubscribe-Post). Mail clients POST here without opening a page. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await setUnsub(token, "main", true);
  return new NextResponse(r.error ? "Link not valid" : "Unsubscribed", { status: r.error ? 400 : 200, headers: { "cache-control": "no-store" } });
}

/** A person who opens the header link in a browser lands on the page instead. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return NextResponse.redirect(new URL(`/unsubscribe/${encodeURIComponent(token)}`, req.url));
}
