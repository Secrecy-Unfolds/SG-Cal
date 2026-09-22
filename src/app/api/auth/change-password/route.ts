import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  getSession,
  hashPassword,
  secondsUntilNextMuscatMidnight,
  SESSION_COOKIE,
  signSession,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  const res = await query<{ id: number; username: string; password_hash: string; must_change_password: boolean }>(
    "SELECT id, username, password_hash, must_change_password FROM users WHERE id = $1",
    [session.uid]
  );
  const user = res.rows[0];
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }
  // After a Super-Admin reset the whole point is choosing your own — keeping
  // the temporary one would defeat it.
  if (user.must_change_password && newPassword === currentPassword) {
    return NextResponse.json({ error: "Choose a password different from the temporary one" }, { status: 400 });
  }

  const newHash = await hashPassword(newPassword);
  await query("UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2", [
    newHash,
    user.id,
  ]);

  const response = NextResponse.json({ ok: true });
  // Always re-sign the session (without the "must change password" lock):
  // the old token may still carry it, which would keep the middleware
  // redirecting even though the DB flag is now clear.
  const token = await signSession({ uid: user.id, username: user.username, role: session.role });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: secondsUntilNextMuscatMidnight(),
  });
  return response;
}
