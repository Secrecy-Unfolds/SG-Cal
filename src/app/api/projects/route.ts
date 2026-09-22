import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createProject, listProjects } from "@/lib/projects";
import { parseProjectBody } from "@/lib/projectInput";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }
  return NextResponse.json({ projects: await listProjects() });
}

// Admin-level only for now (confirmed): Admins and Super Admins manage the
// org structure; Project Heads editing their own project comes with the
// visibility phase.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can create projects" }, { status: 403 });
  }

  const parsed = await parseProjectBody(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const result = await createProject(parsed.input, session.uid);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ project: result.project }, { status: 201 });
}
