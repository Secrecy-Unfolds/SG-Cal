import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { createInvoice, listInvoices } from "@/lib/invoices";
import type { LineItemInput } from "@/lib/invoices";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "accounting"))) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const invoices = await listInvoices();
  return NextResponse.json({ invoices });
}

function parseLineItems(value: unknown): LineItemInput[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items: LineItemInput[] = [];
  for (const raw of value) {
    const description = typeof raw?.description === "string" ? raw.description.trim() : "";
    const quantity = typeof raw?.quantity === "number" ? raw.quantity : NaN;
    const unitPrice = typeof raw?.unitPrice === "number" ? raw.unitPrice : NaN;
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;
    items.push({ description, quantity, unitPrice });
  }
  return items;
}

// Any Admin-level can create/send an invoice — confirmed 2026-09-16, no
// extra approval gate on the revenue side (unlike the expense-approval
// threshold, which is specifically about spend).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can create invoices" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const customerId = typeof body?.customerId === "number" ? body.customerId : NaN;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "OMR";
  const date = typeof body?.date === "string" && body.date ? body.date : new Date().toISOString().slice(0, 10);
  const dueDate = typeof body?.dueDate === "string" && body.dueDate ? body.dueDate : null;
  const lineItems = parseLineItems(body?.lineItems);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return NextResponse.json({ error: "A valid customerId is required" }, { status: 400 });
  }
  if (!lineItems) {
    return NextResponse.json({ error: "At least one valid line item is required" }, { status: 400 });
  }

  try {
    const invoice = await createInvoice({ customerId, currency, date, dueDate, lineItems, createdBy: session.uid });
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err: any) {
    if (err?.message === "Customer not found") {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    throw err;
  }
}
