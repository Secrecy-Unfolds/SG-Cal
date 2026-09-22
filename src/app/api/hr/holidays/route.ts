import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { addPublicHolidays, listPublicHolidays } from "@/lib/hr";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Any signed-in user can read the list — the leave-request form needs it to
// preview how many working days a range counts.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ holidays: await listPublicHolidays() });
}

// Admin-level only. `toDate` is optional (a single day); a range adds one
// row per day, up to 31.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can manage public holidays" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const fromDate = typeof body?.fromDate === "string" ? body.fromDate : "";
  const toDate = typeof body?.toDate === "string" && body.toDate ? body.toDate : fromDate;

  if (!name) return NextResponse.json({ error: "A name is required" }, { status: 400 });
  if (!DATE_RE.test(fromDate) || !DATE_RE.test(toDate)) {
    return NextResponse.json({ error: "A valid date is required" }, { status: 400 });
  }
  if (toDate < fromDate) {
    return NextResponse.json({ error: "The end date must be on or after the start date" }, { status: 400 });
  }
  const spanDays = (Date.parse(toDate) - Date.parse(fromDate)) / 86_400_000 + 1;
  if (spanDays > 31) {
    return NextResponse.json({ error: "A holiday can span at most 31 days — add it in parts" }, { status: 400 });
  }

  const added = await addPublicHolidays({ fromDate, toDate, name, createdBy: session.uid });
  return NextResponse.json({ added }, { status: 201 });
}
