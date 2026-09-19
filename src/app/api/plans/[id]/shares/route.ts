import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getPlanById } from "@/lib/plans";
import { listPlanShares, setPlanShares } from "@/lib/planShares";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Admin-level-only, both ways — sharing a plan is an authoring action,
// same as everything else in this module.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view sharing" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const plan = await getPlanById(id);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const users = await listPlanShares(id);
  return NextResponse.json({ users });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can share a plan" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const plan = await getPlanById(id);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (plan.parent_milestone_id !== null) {
    return NextResponse.json({ error: "A Stage can't be shared directly — share its Strategy instead" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const userIds: number[] = Array.isArray(body?.userIds)
    ? body.userIds.filter((id: unknown): id is number => typeof id === "number")
    : [];

  await setPlanShares(id, userIds, session.uid);
  const users = await listPlanShares(id);
  return NextResponse.json({ users });
}
