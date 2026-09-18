import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPreferencesForUser, isNotificationCategory, setPreference } from "@/lib/notificationPreferences";

export const runtime = "nodejs";

// Self-service only (confirmed 2026-09-18) — always the caller's own
// preferences, no userId param.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const preferences = await getPreferencesForUser(session.uid);
  return NextResponse.json({ preferences });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!isNotificationCategory(body?.category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  await setPreference(session.uid, body.category, body.enabled);
  const preferences = await getPreferencesForUser(session.uid);
  return NextResponse.json({ preferences });
}
