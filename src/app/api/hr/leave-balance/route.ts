import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLeaveBalance, listPublicHolidays } from "@/lib/hr";

export const runtime = "nodejs";

// The signed-in user's own balance for the current calendar year, plus the
// public holiday list (so the request form can preview a day count). Any
// role — an Admin has their own leave too.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [balance, holidays] = await Promise.all([getLeaveBalance(session.uid), listPublicHolidays()]);
  return NextResponse.json({ balance, holidays: holidays.map((h) => h.holiday_date) });
}
