import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getPurchaseOrderById } from "@/lib/purchaseOrders";
import { getVendorById } from "@/lib/procurement";
import { renderPurchaseOrderPdf } from "@/lib/pdf/purchaseOrderPdf";
import { purchaseOrderVendorEmail } from "@/lib/purchaseOrderEmailTemplates";
import { sendMail } from "@/lib/mailer";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Sends the PO PDF directly to the vendor's own email (Phase 1's contact
// fields) — the app's third outbound email to an external, non-account
// recipient (after the customer invoice email and the RFQ email).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can email a purchase order" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const po = await getPurchaseOrderById(id);
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const vendor = po.vendor_id ? await getVendorById(po.vendor_id) : null;
  if (!vendor?.email) {
    return NextResponse.json({ error: "This vendor has no email on file — add one before sending" }, { status: 400 });
  }

  const buffer = await renderPurchaseOrderPdf(po, vendor);
  const { subject, html } = purchaseOrderVendorEmail(po, session.username);

  try {
    await sendMail({
      to: [vendor.email],
      subject,
      html,
      attachment: { filename: `PO-${po.id}.pdf`, mimeType: "application/pdf", base64: buffer.toString("base64") },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to send email" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
