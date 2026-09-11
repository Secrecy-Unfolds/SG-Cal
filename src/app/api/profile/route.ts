import { NextRequest, NextResponse } from "next/server";
import { getSession, signSession, SESSION_COOKIE, secondsUntilNextMuscatMidnight } from "@/lib/auth";
import { updateProfile, usernameExists } from "@/lib/users";

export const runtime = "nodejs";

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!username || !email) {
    return NextResponse.json({ error: "Username and email are required" }, { status: 400 });
  }

  const usernameChanged = username !== session.username;
  if (usernameChanged && (await usernameExists(username, session.uid))) {
    return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
  }

  const user = await updateProfile(session.uid, { name, username, email, phone });

  const response = NextResponse.json({ user });
  if (usernameChanged) {
    const token = await signSession({ uid: session.uid, username: user.username, role: session.role });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: secondsUntilNextMuscatMidnight(),
    });
  }

  return response;
}
