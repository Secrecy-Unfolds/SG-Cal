import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createCapitalBudget, listCapitalBudgets } from "@/lib/capitalBudgets";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const budgets = await listCapitalBudgets();
  return NextResponse.json({ budgets });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add budgets" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const periodStart = typeof body?.periodStart === "string" && body.periodStart ? body.periodStart : "";
  const periodEnd = typeof body?.periodEnd === "string" && body.periodEnd ? body.periodEnd : "";
  const productId = typeof body?.productId === "number" ? body.productId : null;
  const amount = typeof body?.amount === "number" ? body.amount : NaN;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "OMR";

  if (!periodStart || !periodEnd) {
    return NextResponse.json({ error: "A period start and end date are required" }, { status: 400 });
  }
  if (periodEnd < periodStart) {
    return NextResponse.json({ error: "Period end must be on or after period start" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
  }

  const budget = await createCapitalBudget({
    label,
    periodStart,
    periodEnd,
    productId,
    amount,
    currency,
    createdBy: session.uid,
  });
  return NextResponse.json({ budget }, { status: 201 });
}
