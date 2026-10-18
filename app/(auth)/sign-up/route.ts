import { NextResponse, type NextRequest } from "next/server";

// Sign-up is the 3-step flow starting at /create-account (canvas PR06).
export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/create-account";
  return NextResponse.redirect(url);
}
