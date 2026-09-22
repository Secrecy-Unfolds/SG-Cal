import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { createRecurringExpense, listRecurringExpenses } from "@/lib/recurringExpenses";
import { isRecurringExpenseFrequency } from "@/lib/accountingDisplay";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "accounting"))) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const recurring = await listRecurringExpenses();
  return NextResponse.json({ recurring });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add recurring expenses" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const amount = typeof body?.amount === "number" ? body.amount : NaN;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "OMR";
  const frequency = isRecurringExpenseFrequency(body?.frequency) ? body.frequency : null;
  const nextRunDate = typeof body?.nextRunDate === "string" && body.nextRunDate ? body.nextRunDate : "";

  if (!frequency) {
    return NextResponse.json({ error: "frequency must be weekly, monthly, quarterly, or yearly" }, { status: 400 });
  }
  if (!nextRunDate) return NextResponse.json({ error: "A first run date is required" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
  }

  const recurring = await createRecurringExpense({
    description,
    category,
    amount,
    currency,
    frequency,
    nextRunDate,
    createdBy: session.uid,
  });
  return NextResponse.json({ recurring }, { status: 201 });
}
