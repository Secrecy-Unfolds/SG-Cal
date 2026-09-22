import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { getVendorInvoiceById } from "@/lib/vendorInvoices";
import { getPurchaseOrderById } from "@/lib/purchaseOrders";
import { renderVendorInvoicePdf } from "@/lib/pdf/vendorInvoicePdf";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Internal record only — never sent externally, see vendorInvoicePdf.tsx.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "procurement"))) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const invoice = await getVendorInvoiceById(id);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const po = await getPurchaseOrderById(invoice.purchase_order_id);
  if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });

  const buffer = await renderVendorInvoicePdf(invoice, po);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="vendor-invoice-${invoice.id}.pdf"`,
    },
  });
}
