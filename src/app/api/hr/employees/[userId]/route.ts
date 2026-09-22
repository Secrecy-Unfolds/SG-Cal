import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getEmployeeDetailsForViewer, upsertEmployeeDetails } from "@/lib/hr";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Self, Admin-level, or a strict superior in the reporting chain can view one
// employee's HR record (0.2.17 — "sensitive-field visibility is
// hierarchical, not a flat Admin-level gate"; see lib/hr.ts's
// getEmployeeDetailsForViewer for exactly what a hierarchical superior does
// and doesn't see). Self sees their own on Profile; Admin-level sees
// anyone's on the /hr management page; a superior sees their reports' via
// the "My Team" card.
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = parseId(params.userId);
  if (!userId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const result = await getEmployeeDetailsForViewer(userId, session.uid, session.role);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason === "not_found" ? "Not found" : "Not allowed" },
      { status: result.reason === "not_found" ? 404 : 403 }
    );
  }
  return NextResponse.json({ employee: result.employee, isHierarchicalView: result.isHierarchicalView });
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
  const str = (key: string) => (typeof body?.[key] === "string" ? body[key].trim() : "");
  const dateOrNull = (key: string) => (typeof body?.[key] === "string" && body[key] ? body[key] : null);

  const position = str("position");
  const departmentId = typeof body?.departmentId === "number" ? body.departmentId : null;
  const jobTitleId = typeof body?.jobTitleId === "number" ? body.jobTitleId : null;
  const reportsToId = typeof body?.reportsToId === "number" ? body.reportsToId : null;
  const joinDate = dateOrNull("joinDate");
  const salary = typeof body?.salary === "number" ? body.salary : null;
  const salaryCurrency = str("salaryCurrency") || "OMR";
  const emergencyContactName = str("emergencyContactName");
  const emergencyContactPhone = str("emergencyContactPhone");
  // Per-employee annual leave allowance in days (half days allowed); null =
  // none set. Counted per calendar year — see lib/hrDisplay.ts.
  const annualLeaveDays = typeof body?.annualLeaveDays === "number" ? body.annualLeaveDays : null;
  if (annualLeaveDays !== null && !(annualLeaveDays >= 0 && annualLeaveDays <= 366)) {
    return NextResponse.json({ error: "Annual leave allowance must be between 0 and 366 days" }, { status: 400 });
  }

  // Richer details (0.2.17) — all optional free text/dates, fixed columns
  // (not a custom-fields mechanism, confirmed).
  const civilId = str("civilId");
  const civilIdExpiry = dateOrNull("civilIdExpiry");
  const passportNumber = str("passportNumber");
  const passportExpiry = dateOrNull("passportExpiry");
  const visaExpiry = dateOrNull("visaExpiry");
  const contractExpiry = dateOrNull("contractExpiry");
  const fatherName = str("fatherName");
  const religion = str("religion");
  const country = str("country");
  const dateOfBirth = dateOrNull("dateOfBirth");
  const gender = str("gender");
  const educationLevel = str("educationLevel");
  const degreeField = str("degreeField");
  const graduationDate = dateOrNull("graduationDate");
  const yearsExperience = typeof body?.yearsExperience === "number" ? body.yearsExperience : null;
  if (yearsExperience !== null && !(yearsExperience >= 0 && yearsExperience <= 80)) {
    return NextResponse.json({ error: "Years of experience must be between 0 and 80" }, { status: 400 });
  }
  const recommendedBy = str("recommendedBy");

  const result = await upsertEmployeeDetails(userId, {
    position,
    departmentId,
    jobTitleId,
    reportsToId,
    joinDate,
    salary,
    salaryCurrency,
    emergencyContactName,
    emergencyContactPhone,
    annualLeaveDays,
    civilId,
    civilIdExpiry,
    passportNumber,
    passportExpiry,
    visaExpiry,
    contractExpiry,
    fatherName,
    religion,
    country,
    dateOfBirth,
    gender,
    educationLevel,
    degreeField,
    graduationDate,
    yearsExperience,
    recommendedBy,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.notFound ? 404 : 400 });
  return NextResponse.json({ employee: result.employee });
}
