import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkOut, getAttendanceForDate } from "@/lib/hr";
import { getMuscatNowParts } from "@/lib/time";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dateKey } = getMuscatNowParts();
  const existing = await getAttendanceForDate(session.uid, dateKey);
  if (!existing) {
    return NextResponse.json({ error: "You haven't checked in today yet" }, { status: 400 });
  }
  if (existing.check_out_at) {
    return NextResponse.json({ error: "Already checked out today" }, { status: 400 });
  }

  const record = await checkOut(session.uid, dateKey);
  return NextResponse.json({ record });
}
