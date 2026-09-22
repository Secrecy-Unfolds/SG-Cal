import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { canAccessModule } from "@/lib/orgModules";
import { createRequisition, listRequisitions } from "@/lib/purchaseRequisitions";
import { getAdminLevelRecipientEmails, sendMailInBackground } from "@/lib/mailer";
import { requisitionSubmittedEmail } from "@/lib/procurementEmailTemplates";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role) && !(await canAccessModule(session, "procurement"))) {
    return NextResponse.json({ error: "Only Admin-level accounts can view requisitions" }, { status: 403 });
  }

  const requisitions = await listRequisitions();
  return NextResponse.json({ requisitions });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admin-level accounts can submit a requisition" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const productName = typeof body?.productName === "string" ? body.productName.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const quantityNeeded = Number.isFinite(body?.quantityNeeded) && body.quantityNeeded > 0 ? Math.floor(body.quantityNeeded) : 1;
  const quantityUnit = typeof body?.quantityUnit === "string" && body.quantityUnit.trim() ? body.quantityUnit.trim() : "pcs";
  const justification = typeof body?.justification === "string" ? body.justification.trim() : "";

  if (!productName) {
    return NextResponse.json({ error: "Product name is required" }, { status: 400 });
  }

  const requisition = await createRequisition({
    productName,
    description,
    quantityNeeded,
    quantityUnit,
    justification,
    requestedBy: session.uid,
  });

  const recipients = await getAdminLevelRecipientEmails("procurement");
  const { subject, html } = requisitionSubmittedEmail(requisition, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ requisition }, { status: 201 });
}
