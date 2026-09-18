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

function parseRating(value: unknown): number | null {
  return Number.isFinite(value) && (value as number) >= 1 && (value as number) <= 5 ? Math.round(value as number) : null;
}

function parseOfferingBody(body: any) {
  const pricing = typeof body?.pricing === "string" ? body.pricing.trim() : "";
  const paymentTerms = typeof body?.paymentTerms === "string" ? body.paymentTerms.trim() : "";
  const qualityRating = parseRating(body?.qualityRating);
  const deliveryPeriod = typeof body?.deliveryPeriod === "string" ? body.deliveryPeriod.trim() : "";
  const warranty = typeof body?.warranty === "string" ? body.warranty.trim() : "";
  const priceRating = parseRating(body?.priceRating);
  const deliveryRating = parseRating(body?.deliveryRating);
  const warrantyRating = parseRating(body?.warrantyRating);
  const quoteReceivedOn = typeof body?.quoteReceivedOn === "string" && body.quoteReceivedOn ? body.quoteReceivedOn : null;
  const quoteValidUntil = typeof body?.quoteValidUntil === "string" && body.quoteValidUntil ? body.quoteValidUntil : null;

  return {
    pricing,
    paymentTerms,
    qualityRating,
    deliveryPeriod,
    warranty,
    priceRating,
    deliveryRating,
    warrantyRating,
    quoteReceivedOn,
    quoteValidUntil,
  };
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
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
    const alternateEmail = typeof body?.alternateEmail === "string" ? body.alternateEmail.trim() : "";
    const vendor = await createVendor({ name, country, niche, email, phone, alternateEmail });
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

  if (!product.notifications_muted) {
    const recipients = await getAdminLevelRecipientEmails("procurement");
    const { subject, html } = vendorAddedEmail(product, productVendor, session.username);
    sendMailInBackground({ to: recipients, subject, html });
  }

  return NextResponse.json({ vendor: productVendor }, { status: 201 });
}
