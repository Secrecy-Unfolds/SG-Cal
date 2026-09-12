import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getDigestSettings,
  isValidTime,
  isValidWindowHours,
  isValidWindowDays,
  isValidWeekday,
  setDigestTime,
  setMidnightDigestWindowHours,
  setSaturdayDigestWindowDays,
  setSaturdayDigestWeekday,
} from "@/lib/settings";

export const runtime = "nodejs";

// Genuinely Super-Admin-only — unlike most of the app's "Admin-level" gates
// (isAdminLevel treats admin/super_admin the same), this one really is
// restricted to the single Super Admin account.
function requireSuperAdmin(role: string): string | null {
  if (role !== "super_admin") return "Only the Super Admin can do this";
  return null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissionError = requireSuperAdmin(session.role);
  if (permissionError) return NextResponse.json({ error: permissionError }, { status: 403 });

  const settings = await getDigestSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permissionError = requireSuperAdmin(session.role);
  if (permissionError) return NextResponse.json({ error: permissionError }, { status: 403 });

  const body = await req.json().catch(() => null);
  const midnightDigestTime = typeof body?.midnightDigestTime === "string" ? body.midnightDigestTime : "";
  const saturdayDigestTime = typeof body?.saturdayDigestTime === "string" ? body.saturdayDigestTime : "";
  const midnightDigestWindowHours = Number(body?.midnightDigestWindowHours);
  const saturdayDigestWindowDays = Number(body?.saturdayDigestWindowDays);
  const saturdayDigestWeekday = Number(body?.saturdayDigestWeekday);

  if (!isValidTime(midnightDigestTime) || !isValidTime(saturdayDigestTime)) {
    return NextResponse.json({ error: "Times must be in HH:mm 24-hour format" }, { status: 400 });
  }
  if (!isValidWindowHours(midnightDigestWindowHours)) {
    return NextResponse.json({ error: "Daily digest window must be a whole number of hours (1-720)" }, { status: 400 });
  }
  if (!isValidWindowDays(saturdayDigestWindowDays)) {
    return NextResponse.json({ error: "Weekly digest window must be a whole number of days (1-180)" }, { status: 400 });
  }
  if (!isValidWeekday(saturdayDigestWeekday)) {
    return NextResponse.json({ error: "Weekly digest day must be a day of the week" }, { status: 400 });
  }

  await setDigestTime("midnight", midnightDigestTime);
  await setDigestTime("saturday", saturdayDigestTime);
  await setMidnightDigestWindowHours(midnightDigestWindowHours);
  await setSaturdayDigestWindowDays(saturdayDigestWindowDays);
  await setSaturdayDigestWeekday(saturdayDigestWeekday);

  const settings = await getDigestSettings();
  return NextResponse.json({ settings });
}
