import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAssignRole, getUserById, isAdminLevel, isUserRole, updateUserRole } from "@/lib/users";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can change a user's role" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  if (id === session.uid) {
    return NextResponse.json({ error: "You can't change your own role" }, { status: 403 });
  }

  const existing = await getUserById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.role === "super_admin") {
    return NextResponse.json({ error: "The Super Admin's role can't be changed here" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!isUserRole(body?.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const permissionError = await canAssignRole(session.role, body.role);
  if (permissionError) {
    return NextResponse.json({ error: permissionError }, { status: 403 });
  }

  const user = await updateUserRole(id, body.role);
  return NextResponse.json({ user });
}
