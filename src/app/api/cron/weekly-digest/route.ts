import { NextRequest, NextResponse } from "next/server";
import { maybeSendWeeklyDigest } from "@/lib/digests";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

export const runtime = "nodejs";

// Kept as a fallback for vercel.json's fixed daily trigger — the actual
// Super-Admin-configured send time is what /api/cron/reminder-sweep checks
// on every frequent external ping (see src/lib/digests.ts).
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await maybeSendWeeklyDigest();
  return NextResponse.json({ ok: true, ...result });
}
