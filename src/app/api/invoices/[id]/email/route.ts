import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getCustomerById } from "@/lib/customers";
import { getInvoiceById, listLineItemsForInvoice, markInvoiceSent } from "@/lib/invoices";
import { renderInvoicePdf } from "@/lib/pdf/invoicePdf";
import { invoiceEmail } from "@/lib/invoicesEmailTemplates";
import { sendMail } from "@/lib/mailer";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Sends the invoice to the customer's own email address (not a
// user-supplied address) — with the PDF attached (see EmailAttachment in
// lib/mailer.ts; degrades to link-only until the mail relay script is
// updated to attach it) and a "View / download invoice" link either way.
// A still-draft invoice moves to 'sent' once the email is queued.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can email invoices" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const invoice = await getInvoiceById(id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!invoice.customer_email) {
    return NextResponse.json({ error: "This customer has no email address on file" }, { status: 400 });
  }

  const customer = await getCustomerById(invoice.customer_id);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  const lineItems = await listLineItemsForInvoice(id);

  const buffer = await renderInvoicePdf(invoice, lineItems, customer);
  const { subject, html } = invoiceEmail(invoice, lineItems, customer);

  try {
    await sendMail({
      to: [invoice.customer_email],
      subject,
      html,
      attachment: { filename: `${invoice.invoice_number}.pdf`, mimeType: "application/pdf", base64: buffer.toString("base64") },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to send email" }, { status: 502 });
  }

  const updated = await markInvoiceSent(id);
  return NextResponse.json({ invoice: updated ?? invoice });
}
