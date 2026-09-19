import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createPlan, listPlans } from "@/lib/plans";
import { isPlanType } from "@/lib/planDisplay";
import { sendMailInBackground, getAdminLevelRecipientEmails } from "@/lib/mailer";
import { planCreatedEmail } from "@/lib/planEmailTemplates";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const typeParam = req.nextUrl.searchParams.get("type");
  const planType = typeParam && isPlanType(typeParam) ? typeParam : undefined;

  const plans = await listPlans(planType);
  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add plans" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const planType = typeof body?.planType === "string" ? body.planType : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const startDate = typeof body?.startDate === "string" && body.startDate ? body.startDate : null;

  if (!isPlanType(planType)) {
    return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const plan = await createPlan({ planType, name, description, startDate, createdBy: session.uid });

  const recipients = await getAdminLevelRecipientEmails("ideas");
  const { subject, html } = planCreatedEmail(plan);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ plan }, { status: 201 });
}
