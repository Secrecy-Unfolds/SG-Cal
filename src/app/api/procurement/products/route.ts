import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createProduct, isProcurementStatus, listProducts } from "@/lib/procurement";
import { getAdminLevelRecipientEmails, sendMailInBackground } from "@/lib/mailer";
import { productCreatedEmail } from "@/lib/procurementEmailTemplates";

export const runtime = "nodejs";

function parseProductBody(body: any) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const pictureUrl = typeof body?.pictureUrl === "string" && body.pictureUrl.trim() ? body.pictureUrl.trim() : null;
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const requiredFor = typeof body?.requiredFor === "string" ? body.requiredFor.trim() : "";
  const requiredBy = typeof body?.requiredBy === "string" && body.requiredBy ? body.requiredBy : null;
  const quantityNeeded = Number.isFinite(body?.quantityNeeded) && body.quantityNeeded > 0 ? Math.floor(body.quantityNeeded) : 1;
  const quantityUnit = typeof body?.quantityUnit === "string" && body.quantityUnit.trim() ? body.quantityUnit.trim() : "pcs";
  const customsNotes = typeof body?.customsNotes === "string" ? body.customsNotes.trim() : "";
  const unitPrice = Number.isFinite(body?.unitPrice) ? body.unitPrice : null;
  const shippingCost = Number.isFinite(body?.shippingCost) ? body.shippingCost : null;
  const customsCost = Number.isFinite(body?.customsCost) ? body.customsCost : null;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "OMR";
  const purchaseDateExpected =
    typeof body?.purchaseDateExpected === "string" && body.purchaseDateExpected ? body.purchaseDateExpected : null;
  const expectedArrival =
    typeof body?.expectedArrival === "string" && body.expectedArrival ? body.expectedArrival : null;
  const status = isProcurementStatus(body?.status) ? body.status : "planning";
  const preferenceRemarks = typeof body?.preferenceRemarks === "string" ? body.preferenceRemarks.trim() : "";

  return {
    name,
    pictureUrl,
    description,
    requiredFor,
    requiredBy,
    quantityNeeded,
    quantityUnit,
    customsNotes,
    unitPrice,
    shippingCost,
    customsCost,
    currency,
    purchaseDateExpected,
    expectedArrival,
    status,
    preferenceRemarks,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can view procurement planning" }, { status: 403 });
  }

  const products = await listProducts();
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can add products" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const input = parseProductBody(body);
  if (!input.name) {
    return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  }

  const product = await createProduct({ ...input, createdBy: session.uid });

  const recipients = await getAdminLevelRecipientEmails();
  const { subject, html } = productCreatedEmail(product, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ product }, { status: 201 });
}
