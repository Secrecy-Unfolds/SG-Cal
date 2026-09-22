import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { closePeriod, listClosedPeriods } from "@/lib/periodClosing";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "accounting"))) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const periods = await listClosedPeriods();
  return NextResponse.json({ periods });
}

// Super-Admin-only — mirrors the Settings page's existing Super-Admin-only
// gate. Closing is more consequential than the rest of Admin-level's usual
// reach (it locks other Admins out of editing/deleting past transactions).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") {
    return NextResponse.json({ error: "Only a Super Admin can close a period" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const periodStart = typeof body?.periodStart === "string" && body.periodStart ? body.periodStart : "";
  const periodEnd = typeof body?.periodEnd === "string" && body.periodEnd ? body.periodEnd : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";

  if (!periodStart || !periodEnd) {
    return NextResponse.json({ error: "A period start and end date are required" }, { status: 400 });
  }
  if (periodEnd < periodStart) {
    return NextResponse.json({ error: "Period end must be on or after period start" }, { status: 400 });
  }

  const period = await closePeriod({ periodStart, periodEnd, label, closedBy: session.uid });
  return NextResponse.json({ period }, { status: 201 });
}
