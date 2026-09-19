import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getStepById } from "@/lib/planSteps";
import { upsertMinutesOfMeeting } from "@/lib/planMinutesOfMeeting";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Admin-level-only for now, same simplification as every other
// plans/steps write path in this build (see the status route's comment).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can fill Minutes of Meeting" }, { status: 403 });
  }

  const stepId = parseId(params.id);
  if (!stepId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const step = await getStepById(stepId);
  if (!step) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (step.step_type !== "meeting") {
    return NextResponse.json({ error: "Minutes of Meeting only applies to Meeting-type steps" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const attendees = typeof body?.attendees === "string" ? body.attendees : "";
  const discussion = typeof body?.discussion === "string" ? body.discussion : "";
  const decisions = typeof body?.decisions === "string" ? body.decisions : "";
  const actionItems = typeof body?.actionItems === "string" ? body.actionItems : "";

  await upsertMinutesOfMeeting(stepId, { attendees, discussion, decisions, actionItems }, session.uid);

  const updated = await getStepById(stepId);
  return NextResponse.json({ step: updated });
}
