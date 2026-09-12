import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDigestSettings, isValidTime, setDigestTime } from "@/lib/settings";

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

  if (!isValidTime(midnightDigestTime) || !isValidTime(saturdayDigestTime)) {
    return NextResponse.json({ error: "Times must be in HH:mm 24-hour format" }, { status: 400 });
  }

  await setDigestTime("midnight", midnightDigestTime);
  await setDigestTime("saturday", saturdayDigestTime);

  const settings = await getDigestSettings();
  return NextResponse.json({ settings });
}
