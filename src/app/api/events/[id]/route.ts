import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  canEditTask,
  canManageAttendees,
  deleteEvent,
  getEventById,
  isEventType,
  isTaskStatus,
  resolveTaskAssignment,
  setAttendees,
  updateEvent,
  validateEventTiming,
} from "@/lib/events";
import { getEmailsByIds } from "@/lib/users";
import { sendMailInBackground, getAllRecipientEmails } from "@/lib/mailer";
import { eventCanceledEmail, eventUpdatedEmail, meetingAttendeeRemovedEmail } from "@/lib/emailTemplates";

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
  const requestedAttendeeIds: number[] = Array.isArray(body?.attendeeIds)
    ? body.attendeeIds.filter((id: unknown): id is number => typeof id === "number")
    : [];

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

  let event = await updateEvent(id, {
    title,
    description,
    type,
    isTentative,
    startAt,
    endAt,
    assigneeId: assignment.assigneeId,
    status: assignment.status,
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  let recipients: string[];
  if (type === "meeting") {
    if (canManageAttendees({ uid: session.uid, role: session.role }, existing)) {
      const { removed } = await setAttendees(event.id, requestedAttendeeIds);
      if (removed.length > 0) {
        const removedEmails = await getEmailsByIds(removed);
        const { subject: removedSubject, html: removedHtml } = meetingAttendeeRemovedEmail(
          event,
          session.username
        );
        sendMailInBackground({ to: removedEmails, subject: removedSubject, html: removedHtml });
      }
      event = (await getEventById(event.id)) ?? event;
    }
    recipients = await getEmailsByIds(event.attendees.map((a) => a.id));
  } else {
    recipients = await getAllRecipientEmails();
  }

  const { subject, html } = eventUpdatedEmail(event, session.username);
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

  const recipients =
    existing.type === "meeting"
      ? await getEmailsByIds(existing.attendees.map((a) => a.id))
      : await getAllRecipientEmails();

  await deleteEvent(id);

  const { subject, html } = eventCanceledEmail(existing, session.username);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ ok: true });
}
