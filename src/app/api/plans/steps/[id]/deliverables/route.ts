import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getStepById } from "@/lib/planSteps";
import { addDeliverableDef, isDeliverableKind } from "@/lib/planDeliverables";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Admin-level-only, matching every other plans/steps route in this build —
// defining a deliverable placeholder is part of authoring the workflow.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add a deliverable" }, { status: 403 });
  }

  const stepId = parseId(params.id);
  if (!stepId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const step = await getStepById(stepId);
  if (!step) return NextResponse.json({ error: "Step not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const kind = body?.kind;
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!isDeliverableKind(kind) || !label) {
    return NextResponse.json({ error: "kind and label are required" }, { status: 400 });
  }

  const def = await addDeliverableDef({ stepId, kind, label, sortOrder: step.deliverable_defs.length });
  return NextResponse.json({ id: def.id }, { status: 201 });
}
