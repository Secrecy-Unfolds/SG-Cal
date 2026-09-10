import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  canEditTask,
  deleteEvent,
  getEventById,
  isEventType,
  isTaskStatus,
  resolveTaskAssignment,
  updateEvent,
  validateEventTiming,
} from "@/lib/events";
import { sendMailInBackground, getAllRecipientEmails } from "@/lib/mailer";
import { eventCanceledEmail, eventUpdatedEmail } from "@/lib/emailTemplates";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getEventById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditTask({ uid: session.uid, role: session.role }, existing)) {
    return NextResponse.json(
      { error: "Only the assignee or an Admin can edit this task" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const type = isEventType(body?.type) ? body.type : "meeting";
  const isTentative = body?.isTentative === true;
  const startAtStr = typeof body?.startAt === "string" ? body.startAt : "";
  const endAtStr = typeof body?.endAt === "string" ? body.endAt : "";
  const requestedAssigneeId = typeof body?.assigneeId === "number" ? body.assigneeId : null;
  const requestedStatus = isTaskStatus(body?.status) ? body.status : null;

  if (!title || !startAtStr) {
    return NextResponse.json({ error: "title and startAt are required" }, { status: 400 });
  }
  const startAt = new Date(startAtStr);
  const endAt = endAtStr ? new Date(endAtStr) : null;
  if (isNaN(startAt.getTime()) || (endAt && isNaN(endAt.getTime()))) {
    return NextResponse.json({ error: "Invalid start/end date" }, { status: 400 });
  }
  const timingError = validateEventTiming({ type, isTentative, startAt, endAt });
  if (timingError) {
    return NextResponse.json({ error: timingError }, { status: 400 });
  }

  const assignment = await resolveTaskAssignment({
    type,
    actorUid: session.uid,
    actorRole: session.role,
    requestedAssigneeId,
    requestedStatus,
    previousStatus: existing.status,
  });
  if (!assignment.ok) {
    return NextResponse.json({ error: assignment.error }, { status: assignment.httpStatus });
  }

  const event = await updateEvent(id, {
    title,
    description,
    type,
    isTentative,
    startAt,
    endAt,
    assigneeId: assignment.assigneeId,
    status: assignment.status,
  });

  const recipients = await getAllRecipientEmails();
  const { subject, html } = eventUpdatedEmail(event!, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ event });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getEventById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditTask({ uid: session.uid, role: session.role }, existing)) {
    return NextResponse.json(
      { error: "Only the assignee or an Admin can delete this task" },
      { status: 403 }
    );
  }

  await deleteEvent(id);

  const recipients = await getAllRecipientEmails();
  const { subject, html } = eventCanceledEmail(existing, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ ok: true });
}
