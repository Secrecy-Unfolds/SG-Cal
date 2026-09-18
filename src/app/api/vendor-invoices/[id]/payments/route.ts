import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getVendorInvoiceById } from "@/lib/vendorInvoices";
import { createPayment, listPaymentsForInvoice } from "@/lib/vendorPayments";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const payments = await listPaymentsForInvoice(id);
  return NextResponse.json({ payments });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can log a payment" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const invoice = await getVendorInvoiceById(id);
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const amount = typeof body?.amount === "number" ? body.amount : NaN;
  const date = typeof body?.date === "string" && body.date ? body.date : new Date().toISOString().slice(0, 10);
  const method = typeof body?.method === "string" ? body.method.trim() : "";
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
  }

  const payment = await createPayment({ vendorInvoiceId: id, amount, date, method, reference, createdBy: session.uid });
  return NextResponse.json({ payment }, { status: 201 });
}
