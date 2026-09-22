import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { createCapitalEntry, listCapitalEntries } from "@/lib/capital";
import { isCapitalSource } from "@/lib/capitalDisplay";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "accounting"))) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const entries = await listCapitalEntries();
  return NextResponse.json({ entries });
}

// Manual entries only — owner contributions, loans, grants, "other".
// Investor/government-support money is posted via /api/investments and
// /api/government-support instead, which link back to their source record.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add capital entries" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const source = isCapitalSource(body?.source) ? body.source : null;
  const amount = typeof body?.amount === "number" ? body.amount : NaN;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "OMR";
  const date = typeof body?.date === "string" && body.date ? body.date : new Date().toISOString().slice(0, 10);
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!source) return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
  }

  const entry = await createCapitalEntry({ source, amount, currency, date, description, createdBy: session.uid });
  return NextResponse.json({ entry }, { status: 201 });
}
