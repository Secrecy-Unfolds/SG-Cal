import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createStage, getMilestoneById } from "@/lib/planMilestones";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// A Stage is a plan_type='process' row with parent_milestone_id set — not
// a 4th plan type (see db/schema.sql's comment on `plans`). Created here
// rather than through POST /api/plans since it needs its milestone
// context, not a free-standing plan_type choice.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add a stage" }, { status: 403 });
  }

  const milestoneId = parseId(params.id);
  if (!milestoneId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const milestone = await getMilestoneById(milestoneId);
  if (!milestone) return NextResponse.json({ error: "Milestone not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const startDate = typeof body?.startDate === "string" && body.startDate ? body.startDate : null;
  const prerequisiteStageId = typeof body?.prerequisiteStageId === "number" ? body.prerequisiteStageId : null;

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const result = await createStage({
    milestoneId,
    name,
    description,
    startDate,
    prerequisiteStageId,
    createdBy: session.uid,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
