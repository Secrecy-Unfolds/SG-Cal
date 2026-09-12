import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createTransaction, isTransactionType, listTransactions } from "@/lib/accounting";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const transactions = await listTransactions();
  return NextResponse.json({ transactions });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add transactions" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const date = typeof body?.date === "string" && body.date ? body.date : new Date().toISOString().slice(0, 10);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const amount = typeof body?.amount === "number" ? body.amount : NaN;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "OMR";
  const type = isTransactionType(body?.type) ? body.type : null;
  const category = typeof body?.category === "string" ? body.category.trim() : "";

  if (!type) {
    return NextResponse.json({ error: "type must be 'income' or 'expense'" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
  }

  const transaction = await createTransaction({
    date,
    description,
    amount,
    currency,
    type,
    category,
    createdBy: session.uid,
  });

  return NextResponse.json({ transaction }, { status: 201 });
}
