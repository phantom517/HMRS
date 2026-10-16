import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "hospital_hrms_session_user";

/**
 * Sends unauthenticated visitors straight to the login screen.
 * Static assets / Next internals are left untouched.
 */
export function middleware(request: NextRequest) {
  const isLoggedOut = request.cookies.get("hospital_hrms_logged_out")?.value === "1";
  const sessionUser = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  // If user has a valid session cookie and visits /login, send them to the dashboard
  if (sessionUser && !isLoggedOut && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // If user explicitly logged out and tries to access protected pages, redirect to /login
  if (isLoggedOut && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals, static files and api routes
    "/((?!_next/static|_next/image|favicon.ico|images|api).*)",
  ],
};
