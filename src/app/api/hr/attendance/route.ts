import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { listAllAttendance, listAttendanceForUser } from "@/lib/hr";

export const runtime = "nodejs";

// Own records by default; ?scope=all (Admin-level only) returns everyone's.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const scope = new URL(req.url).searchParams.get("scope");
  if (scope === "all") {
    if (!isAdminLevel(session.role)) {
      return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
    }
    const records = await listAllAttendance();
    return NextResponse.json({ records });
  }

  const records = await listAttendanceForUser(session.uid);
  return NextResponse.json({ records });
}
