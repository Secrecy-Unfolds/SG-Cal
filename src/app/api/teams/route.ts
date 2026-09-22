import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createTeam } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can create teams" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const projectId = typeof body?.projectId === "number" ? body.projectId : null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const teamLeadId = typeof body?.teamLeadId === "number" ? body.teamLeadId : null;
  if (!projectId) return NextResponse.json({ error: "Choose the project this team belongs to" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "A team name is required" }, { status: 400 });
  if (!teamLeadId) return NextResponse.json({ error: "Choose the Team Lead" }, { status: 400 });

  const result = await createTeam({ projectId, name, teamLeadId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ team: result.team }, { status: 201 });
}
