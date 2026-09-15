import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteRecurringIncome, updateRecurringIncome } from "@/lib/recurringIncome";
import { isRecurringExpenseFrequency } from "@/lib/accountingDisplay";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit recurring income" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const amount = typeof body?.amount === "number" ? body.amount : NaN;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "OMR";
  const frequency = isRecurringExpenseFrequency(body?.frequency) ? body.frequency : null;
  const nextRunDate = typeof body?.nextRunDate === "string" && body.nextRunDate ? body.nextRunDate : "";
  const active = typeof body?.active === "boolean" ? body.active : true;

  if (!frequency) {
    return NextResponse.json({ error: "frequency must be weekly, monthly, quarterly, or yearly" }, { status: 400 });
  }
  if (!nextRunDate) return NextResponse.json({ error: "A next run date is required" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
  }

  const recurring = await updateRecurringIncome(id, { description, category, amount, currency, frequency, nextRunDate, active });
  if (!recurring) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ recurring });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can delete recurring income" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await deleteRecurringIncome(id);
  return NextResponse.json({ ok: true });
}
