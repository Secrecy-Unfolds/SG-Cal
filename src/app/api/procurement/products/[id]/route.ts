import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import {
  deleteProduct,
  getProductById,
  getVendorById,
  isProcurementStatus,
  listVendorsForProduct,
  updateProduct,
} from "@/lib/procurement";
import { getAdminLevelRecipientEmails, sendMailInBackground } from "@/lib/mailer";
import { productDeletedEmail, productUpdatedEmail } from "@/lib/procurementEmailTemplates";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

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
  const preferredVendorId = typeof body?.preferredVendorId === "number" ? body.preferredVendorId : null;

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
    preferredVendorId,
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can view procurement planning" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const product = await getProductById(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const vendors = await listVendorsForProduct(id);
  return NextResponse.json({ product, vendors });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can edit products" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getProductById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const input = parseProductBody(body);
  if (!input.name) {
    return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  }

  if (input.preferredVendorId !== null) {
    const vendor = await getVendorById(input.preferredVendorId);
    if (!vendor || vendor.product_id !== id) {
      return NextResponse.json({ error: "Preferred vendor must belong to this product" }, { status: 400 });
    }
  }

  const product = await updateProduct(id, input);

  const recipients = await getAdminLevelRecipientEmails();
  const { subject, html } = productUpdatedEmail(product!, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ product });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can delete products" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getProductById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteProduct(id);

  const recipients = await getAdminLevelRecipientEmails();
  const { subject, html } = productDeletedEmail(existing, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ ok: true });
}
