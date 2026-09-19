import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { updateStepStatus } from "@/lib/planSteps";
import { isStepStatus, STEP_DONE_BLOCK_REASON_LABELS } from "@/lib/planDisplay";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Admin-level-only for now, same as every other plans/steps route — a
// step's own assignee can still see/edit its backing Calendar entry via
// the normal /api/events path even without plan access, but changing the
// *workflow* status is gated the same way plan-sharing itself is gated in
// this build (see docs/erp-v3-roadmap.md's sharing decision). Revisit once
// Phase 4's plan_shares lands.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can update a step's status" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!isStepStatus(body?.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const result = await updateStepStatus(id, body.status, session.uid);
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: STEP_DONE_BLOCK_REASON_LABELS[result.reason], reason: result.reason },
      { status: 400 }
    );
  }

  return NextResponse.json({ step: result.step });
}
