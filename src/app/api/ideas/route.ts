import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { createIdea, listIdeas } from "@/lib/ideas";
import { sendMailInBackground, getAdminLevelRecipientEmails } from "@/lib/mailer";
import { ideaCreatedEmail } from "@/lib/ideasEmailTemplates";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can view this" }, { status: 403 });
  }

  const ideas = await listIdeas();
  return NextResponse.json({ ideas });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can add ideas" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const prerequisites = typeof body?.prerequisites === "string" ? body.prerequisites.trim() : "";
  const expectedStartDate = typeof body?.expectedStartDate === "string" && body.expectedStartDate ? body.expectedStartDate : null;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const idea = await createIdea({
    name,
    description,
    prerequisites,
    expectedStartDate,
    createdBy: session.uid,
  });

  const recipients = await getAdminLevelRecipientEmails();
  const { subject, html } = ideaCreatedEmail(idea);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ idea }, { status: 201 });
}
