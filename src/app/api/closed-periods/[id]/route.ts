import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClosedPeriodById, reopenPeriod } from "@/lib/periodClosing";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Super-Admin-only — confirmed scope: reopening a closed period.
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") {
    return NextResponse.json({ error: "Only a Super Admin can reopen a period" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getClosedPeriodById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.reopened_at) return NextResponse.json({ error: "Already reopened" }, { status: 400 });

  const period = await reopenPeriod(id, session.uid);
  return NextResponse.json({ period });
}
