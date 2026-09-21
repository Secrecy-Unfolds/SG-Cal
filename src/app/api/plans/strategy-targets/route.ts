import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { listStrategyTargets } from "@/lib/planMilestones";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can do this" }, { status: 403 });
  }
  return NextResponse.json({ strategies: await listStrategyTargets() });
}
