import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isWaitlistMode } from "./lib/waitlist";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (isWaitlistMode()) {
    if (path.startsWith("/dashboard") || path.startsWith("/project")) {
      return NextResponse.redirect(new URL("/waitlist", request.url));
    }
  }

  if (!path.startsWith("/admin")) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);

  // Optimistic redirect based on cookie presence; validate in page/route
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: ["/admin/:path*", "/dashboard/:path*", "/project/:path*"],
};
