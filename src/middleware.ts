import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|logo-square-navy.png|logo-square-white.png|logo-wide-navy.png|logo-wide-white.png|api/cron|api/auth/login|api/auth/logout).*)",
  ],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // A session flagged "must change password" (Super-Admin reset) can only
  // reach the change-password page/API and logout — everything else bounces
  // there, so the temporary password can't be used as a normal login.
  if (session.mcp) {
    const allowed = pathname === "/change-password" || pathname === "/api/auth/change-password";
    if (!allowed) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "You must change your password first", code: "PASSWORD_CHANGE_REQUIRED" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/change-password", req.url));
    }
  }

  return NextResponse.next();
}
