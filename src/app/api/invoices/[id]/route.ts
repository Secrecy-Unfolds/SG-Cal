import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { deleteInvoice, getInvoiceById, listLineItemsForInvoice, updateInvoice } from "@/lib/invoices";
import type { LineItemInput } from "@/lib/invoices";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "accounting"))) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const invoice = await getInvoiceById(id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const lineItems = await listLineItemsForInvoice(id);
  return NextResponse.json({ invoice, lineItems });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit invoices" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

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
    const invoice = await updateInvoice(id, { customerId, currency, date, dueDate, lineItems });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ invoice });
  } catch (err: any) {
    if (err?.message === "INVOICE_PAID") {
      return NextResponse.json({ error: "A paid invoice can't be edited" }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can delete invoices" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    await deleteInvoice(id);
  } catch (err: any) {
    if (err?.message === "INVOICE_PAID") {
      return NextResponse.json({ error: "A paid invoice can't be deleted" }, { status: 400 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
