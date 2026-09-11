import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import {
  getProductById,
  getProductVendorById,
  unlinkVendorFromProduct,
  updateProductVendorOffering,
} from "@/lib/procurement";
import { getAdminLevelRecipientEmails, sendMailInBackground } from "@/lib/mailer";
import { vendorDeletedEmail, vendorUpdatedEmail } from "@/lib/procurementEmailTemplates";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseOfferingBody(body: any) {
  const pricing = typeof body?.pricing === "string" ? body.pricing.trim() : "";
  const paymentTerms = typeof body?.paymentTerms === "string" ? body.paymentTerms.trim() : "";
  const qualityRating =
    Number.isFinite(body?.qualityRating) && body.qualityRating >= 1 && body.qualityRating <= 5
      ? Math.round(body.qualityRating)
      : null;
  const deliveryPeriod = typeof body?.deliveryPeriod === "string" ? body.deliveryPeriod.trim() : "";
  const warranty = typeof body?.warranty === "string" ? body.warranty.trim() : "";

  return { pricing, paymentTerms, qualityRating, deliveryPeriod, warranty };
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can edit vendors" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getProductVendorById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const offering = parseOfferingBody(body);

  const productVendor = await updateProductVendorOffering(id, offering);

  const product = await getProductById(existing.product_id);
  if (product && productVendor) {
    const recipients = await getAdminLevelRecipientEmails();
    const { subject, html } = vendorUpdatedEmail(product, productVendor, session.username);
    sendMailInBackground({ to: recipients, subject, html });
  }

  return NextResponse.json({ vendor: productVendor });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can remove vendors" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getProductVendorById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const product = await getProductById(existing.product_id);

  await unlinkVendorFromProduct(id);

  if (product) {
    const recipients = await getAdminLevelRecipientEmails();
    const { subject, html } = vendorDeletedEmail(product, existing, session.username);
    sendMailInBackground({ to: recipients, subject, html });
  }

  return NextResponse.json({ ok: true });
}
