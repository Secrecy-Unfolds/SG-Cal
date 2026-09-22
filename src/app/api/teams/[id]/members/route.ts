import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { addTeamMember } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can manage team members" }, { status: 403 });
  }

  const teamId = Number(params.id);
  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "number" ? body.userId : null;
  if (!Number.isInteger(teamId) || teamId <= 0 || !userId) {
    return NextResponse.json({ error: "A team and a person are required" }, { status: 400 });
  }

  const result = await addTeamMember(teamId, userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
