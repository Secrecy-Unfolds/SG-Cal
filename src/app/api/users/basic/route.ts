import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listUsersBasic } from "@/lib/users";

export const runtime = "nodejs";

// Open to any authenticated role (unlike GET /api/users, which is
// Admin-only) — a plain "user" creating a meeting needs to see who they can
// invite as an attendee, but shouldn't see everyone's email/role.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await listUsersBasic();
  return NextResponse.json({ users });
}
