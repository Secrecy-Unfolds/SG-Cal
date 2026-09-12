import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getEmployeeDetails, upsertEmployeeDetails } from "@/lib/hr";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Self or Admin-level can view one employee's HR record — an employee can
// see their own (read-only, surfaced on their Profile page); Admin-level
// can see anyone's (the /hr management page).
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseId(params.userId);
  if (!userId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  if (userId !== session.uid && !isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const employee = await getEmployeeDetails(userId);
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ employee });
}

// Admin-level only — any Admin or Super Admin can view/edit any employee's
// HR record, including salary (confirmed: no Super-Admin-only carve-out here).
export async function PUT(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit this" }, { status: 403 });
  }

  const userId = parseId(params.userId);
  if (!userId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const position = typeof body?.position === "string" ? body.position.trim() : "";
  const department = typeof body?.department === "string" ? body.department.trim() : "";
  const joinDate = typeof body?.joinDate === "string" && body.joinDate ? body.joinDate : null;
  const salary = typeof body?.salary === "number" ? body.salary : null;
  const salaryCurrency = typeof body?.salaryCurrency === "string" && body.salaryCurrency.trim()
    ? body.salaryCurrency.trim()
    : "OMR";
  const emergencyContactName = typeof body?.emergencyContactName === "string" ? body.emergencyContactName.trim() : "";
  const emergencyContactPhone = typeof body?.emergencyContactPhone === "string" ? body.emergencyContactPhone.trim() : "";

  const employee = await upsertEmployeeDetails(userId, {
    position,
    department,
    joinDate,
    salary,
    salaryCurrency,
    emergencyContactName,
    emergencyContactPhone,
  });
  if (!employee) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ employee });
}
