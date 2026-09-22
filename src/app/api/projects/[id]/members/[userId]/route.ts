import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { removeProjectMember } from "@/lib/projects";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; userId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can manage project members" }, { status: 403 });
  }

  const projectId = Number(params.id);
  const userId = Number(params.userId);
  if (!Number.isInteger(projectId) || projectId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await removeProjectMember(projectId, userId);
  return NextResponse.json({ ok: true });
}
