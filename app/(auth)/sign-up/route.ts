import { NextResponse, type NextRequest } from "next/server";

// Sign-up lives in the "Create account" tab of the sign-in screen (canvas PR02).
export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.searchParams.set("tab", "create");
  return NextResponse.redirect(url);
}
