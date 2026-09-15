import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteCapitalBudget, updateCapitalBudget } from "@/lib/capitalBudgets";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit budgets" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

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

  const budget = await updateCapitalBudget(id, { label, periodStart, periodEnd, productId, amount, currency });
  if (!budget) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
  return NextResponse.json({ budget });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can delete budgets" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await deleteCapitalBudget(id);
  return NextResponse.json({ ok: true });
}
