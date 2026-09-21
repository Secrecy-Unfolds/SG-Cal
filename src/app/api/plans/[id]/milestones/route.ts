import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getPlanById } from "@/lib/plans";
import { createMilestone, listMilestonesForStrategy } from "@/lib/planMilestones";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add a milestone" }, { status: 403 });
  }

  const strategyPlanId = parseId(params.id);
  if (!strategyPlanId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const plan = await getPlanById(strategyPlanId);
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (plan.plan_type !== "strategy") {
    return NextResponse.json({ error: "Milestones can only be added to a Strategy plan" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const prerequisiteMilestoneId = typeof body?.prerequisiteMilestoneId === "number" ? body.prerequisiteMilestoneId : null;
  const startDate = typeof body?.startDate === "string" && body.startDate ? body.startDate : null;

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const existing = await listMilestonesForStrategy(strategyPlanId);
  const result = await createMilestone({
    strategyPlanId,
    name,
    description,
    startDate,
    prerequisiteMilestoneId,
    sortOrder: existing.length,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ milestone: result.milestone }, { status: 201 });
}
