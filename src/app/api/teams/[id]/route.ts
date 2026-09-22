import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteTeam, getTeamById, updateTeam } from "@/lib/projects";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit teams" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const teamLeadId = typeof body?.teamLeadId === "number" ? body.teamLeadId : null;
  if (!name) return NextResponse.json({ error: "A team name is required" }, { status: 400 });
  if (!teamLeadId) return NextResponse.json({ error: "Choose the Team Lead" }, { status: 400 });

  const result = await updateTeam(id, { name, teamLeadId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.notFound ? 404 : 400 });
  return NextResponse.json({ team: result.team });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can delete teams" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  if (!(await getTeamById(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteTeam(id);
  return NextResponse.json({ ok: true });
}
