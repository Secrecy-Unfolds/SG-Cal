import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createVendor, getProductById } from "@/lib/procurement";
import { getAdminLevelRecipientEmails, sendMailInBackground } from "@/lib/mailer";
import { vendorAddedEmail } from "@/lib/procurementEmailTemplates";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseVendorBody(body: any) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const niche = typeof body?.niche === "string" ? body.niche.trim() : "";
  const country = typeof body?.country === "string" ? body.country.trim() : "";
  const pricing = typeof body?.pricing === "string" ? body.pricing.trim() : "";
  const paymentTerms = typeof body?.paymentTerms === "string" ? body.paymentTerms.trim() : "";
  const qualityRating =
    Number.isFinite(body?.qualityRating) && body.qualityRating >= 1 && body.qualityRating <= 5
      ? Math.round(body.qualityRating)
      : null;
  const deliveryPeriod = typeof body?.deliveryPeriod === "string" ? body.deliveryPeriod.trim() : "";
  const warranty = typeof body?.warranty === "string" ? body.warranty.trim() : "";

  return { name, niche, country, pricing, paymentTerms, qualityRating, deliveryPeriod, warranty };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can add vendors" }, { status: 403 });
  }

  const productId = parseId(params.id);
  if (!productId) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const product = await getProductById(productId);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const input = parseVendorBody(body);
  if (!input.name) {
    return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
  }

  const vendor = await createVendor(productId, input);

  const recipients = await getAdminLevelRecipientEmails();
  const { subject, html } = vendorAddedEmail(product, vendor, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ vendor }, { status: 201 });
}
