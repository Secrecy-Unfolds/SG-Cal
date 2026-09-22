import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createDepartment, listDepartments } from "@/lib/org";
import { isModuleKey, type ModuleKey } from "@/lib/orgModulesDisplay";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }
  return NextResponse.json({ departments: await listDepartments() });
}

function parseDepartmentBody(body: any) {
  const moduleKeys: ModuleKey[] = Array.isArray(body?.moduleKeys) ? body.moduleKeys.filter(isModuleKey) : [];
  return {
    name: typeof body?.name === "string" ? body.name.trim() : "",
    description: typeof body?.description === "string" ? body.description.trim() : "",
    managerId: typeof body?.managerId === "number" ? body.managerId : null,
    directorId: typeof body?.directorId === "number" ? body.directorId : null,
    moduleKeys,
  };
}

// Admin-level only (confirmed): Admins and Super Admins manage the structure.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can manage departments" }, { status: 403 });
  }

  const input = parseDepartmentBody(await req.json().catch(() => null));
  if (!input.name) return NextResponse.json({ error: "A department name is required" }, { status: 400 });

  const result = await createDepartment(input);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ department: result.department }, { status: 201 });
}
