import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { listChiefOfficers } from "@/lib/org";

export const runtime = "nodejs";

// Picker data for a Director's "reports to" on the employee record.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }
  return NextResponse.json({ chiefOfficers: await listChiefOfficers() });
}
