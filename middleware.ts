import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "hospital_hrms_session_user";

/**
 * Sends unauthenticated visitors straight to the login screen.
 * Static assets / Next internals are left untouched.
 */
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!hasSession && !request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals, static files and the login page itself
    "/((?!login|_next/static|_next/image|favicon.ico|images|api).*)",
  ],
};
