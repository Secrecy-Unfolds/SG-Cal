import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import {
  createVendor,
  getProductById,
  linkVendorToProduct,
  VendorAlreadyLinkedError,
} from "@/lib/procurement";
import { getAdminLevelRecipientEmails, sendMailInBackground } from "@/lib/mailer";
import { vendorAddedEmail } from "@/lib/procurementEmailTemplates";

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
  const offering = parseOfferingBody(body);

  let vendorId: number;
  if (typeof body?.vendorId === "number") {
    vendorId = body.vendorId;
  } else {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
    const country = typeof body?.country === "string" ? body.country.trim() : "";
    const niche = typeof body?.niche === "string" ? body.niche.trim() : "";
    const vendor = await createVendor({ name, country, niche });
    vendorId = vendor.id;
  }

  let productVendor;
  try {
    productVendor = await linkVendorToProduct(productId, vendorId, offering);
  } catch (err) {
    if (err instanceof VendorAlreadyLinkedError) {
      return NextResponse.json({ error: "This vendor is already added to this product" }, { status: 409 });
    }
    throw err;
  }

  const recipients = await getAdminLevelRecipientEmails();
  const { subject, html } = vendorAddedEmail(product, productVendor, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ vendor: productVendor }, { status: 201 });
}
