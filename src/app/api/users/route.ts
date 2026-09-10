import { NextRequest, NextResponse } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { canAssignRole, createUser, isUserRole, listUsers, usernameExists } from "@/lib/users";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "user") {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = isUserRole(body?.role) ? body.role : "user";

  if (!username || !email || !password) {
    return NextResponse.json({ error: "Username, email, and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const permissionError = await canAssignRole(session.role, role);
  if (permissionError) {
    return NextResponse.json({ error: permissionError }, { status: 403 });
  }

  if (await usernameExists(username)) {
    return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({ username, passwordHash, email, role });

  return NextResponse.json({ user }, { status: 201 });
}
