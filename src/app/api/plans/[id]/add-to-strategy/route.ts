import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { addProcessToStrategy } from "@/lib/plans";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Adds a standalone Process to a Strategy's Milestone as a Stage — either
// by moving the process itself in, or by duplicating it (see
// lib/plans.ts's addProcessToStrategy for what each mode does).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add a process to a strategy" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const milestoneId = typeof body?.milestoneId === "number" ? body.milestoneId : null;
  const mode = body?.mode === "move" || body?.mode === "duplicate" ? body.mode : null;
  const startDate = typeof body?.startDate === "string" && body.startDate ? body.startDate : null;
  if (!milestoneId || !mode) {
    return NextResponse.json({ error: "milestoneId and mode (move or duplicate) are required" }, { status: 400 });
  }

  const result = await addProcessToStrategy(id, { milestoneId, mode, startDate }, session.uid);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ id: result.id }, { status: 201 });
}
