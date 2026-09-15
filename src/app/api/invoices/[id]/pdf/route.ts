import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getCustomerById } from "@/lib/customers";
import { getInvoiceById, listLineItemsForInvoice } from "@/lib/invoices";
import { renderInvoicePdf } from "@/lib/pdf/invoicePdf";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// The app's one deliberately unauthenticated route — gated by a per-invoice
// random access_token instead of a session, so an emailed "View / download
// invoice" link works for the customer without a login. A logged-in
// Admin-level session also works, without needing the token, for in-app
// downloads. Confirmed 2026-09-16 via `AskUserQuestion`.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const invoice = await getInvoiceById(id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = req.nextUrl.searchParams.get("token");
  let authorized = token !== null && token === invoice.access_token;
  if (!authorized) {
    const session = await getSession();
    authorized = !!session && isAdminLevel(session.role);
  }
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customer = await getCustomerById(invoice.customer_id);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  const lineItems = await listLineItemsForInvoice(id);

  const buffer = await renderInvoicePdf(invoice, lineItems, customer);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
