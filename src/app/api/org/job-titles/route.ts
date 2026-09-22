import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createJobTitle, listJobTitles } from "@/lib/org";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }
  return NextResponse.json({ titles: await listJobTitles() });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can manage job titles" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const level = typeof body?.level === "number" ? Math.round(body.level) : NaN;
  const qualifiedByDepartment = body?.qualifiedByDepartment === true;
  if (!name) return NextResponse.json({ error: "A title name is required" }, { status: 400 });
  if (!(level >= 1 && level <= 99)) {
    return NextResponse.json({ error: "Level must be a whole number from 1 (top) to 99" }, { status: 400 });
  }

  const result = await createJobTitle({ name, level, qualifiedByDepartment });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ title: result.title }, { status: 201 });
}
