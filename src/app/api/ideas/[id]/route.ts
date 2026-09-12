import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { deleteIdea, getIdeaById, updateIdea } from "@/lib/ideas";
import { sendMailInBackground, getAdminLevelRecipientEmails } from "@/lib/mailer";
import { ideaDeletedEmail, ideaUpdatedEmail } from "@/lib/ideasEmailTemplates";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can edit ideas" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const prerequisites = typeof body?.prerequisites === "string" ? body.prerequisites.trim() : "";
  const expectedStartDate = typeof body?.expectedStartDate === "string" && body.expectedStartDate ? body.expectedStartDate : null;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const idea = await updateIdea(id, { name, description, prerequisites, expectedStartDate });
  if (!idea) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const recipients = await getAdminLevelRecipientEmails();
  const { subject, html } = ideaUpdatedEmail(idea, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ idea });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminLevel(session.role)) {
    return NextResponse.json({ error: "Only Admins and Super Admins can delete ideas" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getIdeaById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteIdea(id);

  const recipients = await getAdminLevelRecipientEmails();
  const { subject, html } = ideaDeletedEmail(existing, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ ok: true });
}
