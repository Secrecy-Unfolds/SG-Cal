import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { getProductById, getProductVendorById, isRfqStatus, markRfqSent, updateRfqStatus } from "@/lib/procurement";
import { sendMail } from "@/lib/mailer";
import { rfqEmail } from "@/lib/procurementEmailTemplates";
import { renderRfqPdf } from "@/lib/pdf/rfqPdf";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Sends the RFQ email to the vendor's own address (external recipient) and
// marks the link "requested".
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can send an RFQ" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getProductVendorById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!existing.email) {
    return NextResponse.json({ error: "This vendor has no email on file — add one before sending an RFQ" }, { status: 400 });
  }
  const product = await getProductById(existing.product_id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const vendor = await markRfqSent(id);
  if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderRfqPdf(product, vendor);
  const { subject, html } = rfqEmail(product, vendor, session.username);

  try {
    await sendMail({
      to: [existing.email],
      subject,
      html,
      attachment: { filename: `RFQ-${product.name}.pdf`, mimeType: "application/pdf", base64: buffer.toString("base64") },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to send RFQ email" }, { status: 502 });
  }

  return NextResponse.json({ vendor });
}

// Marks the outcome once the vendor responds (or doesn't) — no email.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can update this" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!isRfqStatus(body?.status)) {
    return NextResponse.json({ error: "status must be 'requested', 'quoted', or 'declined'" }, { status: 400 });
  }

  const vendor = await updateRfqStatus(id, body.status);
  if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ vendor });
}
