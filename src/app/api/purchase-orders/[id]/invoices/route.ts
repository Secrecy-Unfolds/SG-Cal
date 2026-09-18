import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getPurchaseOrderById } from "@/lib/purchaseOrders";
import { createVendorInvoice, listVendorInvoicesForPO } from "@/lib/vendorInvoices";
import { getAdminLevelRecipientEmails, sendMailInBackground } from "@/lib/mailer";
import { transactionFromVendorInvoiceEmail } from "@/lib/accountingEmailTemplates";

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

  const invoices = await listVendorInvoicesForPO(id);
  return NextResponse.json({ invoices });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can log an invoice" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const po = await getPurchaseOrderById(id);
  if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const invoiceNumber = typeof body?.invoiceNumber === "string" ? body.invoiceNumber.trim() : "";
  const invoiceDate = typeof body?.invoiceDate === "string" && body.invoiceDate ? body.invoiceDate : new Date().toISOString().slice(0, 10);
  const amount = typeof body?.amount === "number" ? body.amount : NaN;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : po.currency;
  const dueDate = typeof body?.dueDate === "string" && body.dueDate ? body.dueDate : null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A positive amount is required" }, { status: 400 });
  }

  const { invoice, transaction } = await createVendorInvoice({
    purchaseOrderId: id,
    invoiceNumber,
    invoiceDate,
    amount,
    currency,
    dueDate,
    createdBy: session.uid,
  });

  // Categorized as "accounting", not "procurement" — this is fundamentally
  // a new-expense notice (same as any other transactionXEmail), just
  // triggered from a Procurement action. Someone who mutes Accounting
  // shouldn't keep hearing about new expenses just because they came from
  // a PO invoice instead of a manual entry.
  const recipients = await getAdminLevelRecipientEmails("accounting");
  const { subject, html } = transactionFromVendorInvoiceEmail(transaction, po, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ invoice }, { status: 201 });
}
