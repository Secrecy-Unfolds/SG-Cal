import { NextRequest, NextResponse } from "next/server";
import { ipAddress } from "@vercel/functions";
import { query } from "@/lib/db";
import { verifyPassword, signSession, SESSION_COOKIE, secondsUntilNextMuscatMidnight } from "@/lib/auth";
import { isUserRole } from "@/lib/users";
import { clearLoginAttempts, isLoginRateLimited, recordFailedLogin } from "@/lib/loginRateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rateLimitKey = ipAddress(req) ?? "unknown";
  if (isLoginRateLimited(rateLimitKey)) {
    return NextResponse.json(
      { error: "Too many login attempts — try again in a few minutes" },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  const res = await query<{ id: number; username: string; password_hash: string; role: string }>(
    "SELECT id, username, password_hash, role FROM users WHERE username = $1",
    [username]
  );
  const user = res.rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    recordFailedLogin(rateLimitKey);
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }
  clearLoginAttempts(rateLimitKey);
  const role = isUserRole(user.role) ? user.role : "admin";

  const token = await signSession({ uid: user.id, username: user.username, role });
  const response = NextResponse.json({ ok: true, username: user.username, role });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: secondsUntilNextMuscatMidnight(),
  });
  return response;
}
