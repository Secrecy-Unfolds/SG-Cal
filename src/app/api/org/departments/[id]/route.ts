import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteDepartment, getDepartmentById, updateDepartment } from "@/lib/org";
import { isModuleKey, type ModuleKey } from "@/lib/orgModulesDisplay";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can manage departments" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const managerId = typeof body?.managerId === "number" ? body.managerId : null;
  const directorId = typeof body?.directorId === "number" ? body.directorId : null;
  const moduleKeys: ModuleKey[] = Array.isArray(body?.moduleKeys) ? body.moduleKeys.filter(isModuleKey) : [];
  if (!name) return NextResponse.json({ error: "A department name is required" }, { status: 400 });

  const result = await updateDepartment(id, { name, description, managerId, directorId, moduleKeys });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.notFound ? 404 : 400 });
  return NextResponse.json({ department: result.department });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can manage departments" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  if (!(await getDepartmentById(id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await deleteDepartment(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
