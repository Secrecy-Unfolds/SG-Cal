import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteInventoryItem, getInventoryItemById, isAssetType, updateInventoryItem } from "@/lib/inventory";
import { getAdminLevelRecipientEmails, sendMailInBackground } from "@/lib/mailer";
import { inventoryItemDeletedEmail, inventoryItemUpdatedEmail } from "@/lib/inventoryEmailTemplates";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit items" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const assetType = isAssetType(body?.assetType) ? body.assetType : "consumable";
  const quantity = typeof body?.quantity === "number" ? body.quantity : 1;
  const quantityUnit = typeof body?.quantityUnit === "string" && body.quantityUnit.trim() ? body.quantityUnit.trim() : "pcs";
  const purchaseCost = typeof body?.purchaseCost === "number" ? body.purchaseCost : null;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "OMR";
  const purchaseDate = typeof body?.purchaseDate === "string" && body.purchaseDate ? body.purchaseDate : null;
  const currentValue = typeof body?.currentValue === "number" ? body.currentValue : null;
  const usefulLifeMonths = typeof body?.usefulLifeMonths === "number" ? body.usefulLifeMonths : null;
  const location = typeof body?.location === "string" ? body.location.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const item = await updateInventoryItem(id, {
    name,
    assetType,
    quantity,
    quantityUnit,
    purchaseCost,
    currency,
    purchaseDate,
    currentValue,
    usefulLifeMonths,
    location,
    notes,
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const recipients = await getAdminLevelRecipientEmails("inventory");
  const { subject, html } = inventoryItemUpdatedEmail(item, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can delete items" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getInventoryItemById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteInventoryItem(id);

  const recipients = await getAdminLevelRecipientEmails("inventory");
  const { subject, html } = inventoryItemDeletedEmail(existing, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ ok: true });
}
