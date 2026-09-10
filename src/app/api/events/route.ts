import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createEvent,
  isEventType,
  isTaskStatus,
  listEventsBetween,
  resolveTaskAssignment,
  validateEventTiming,
} from "@/lib/events";
import { sendMailInBackground, getAllRecipientEmails } from "@/lib/mailer";
import { eventCreatedEmail } from "@/lib/emailTemplates";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (!fromParam || !toParam) {
    return NextResponse.json({ error: "from and to query params required (ISO dates)" }, { status: 400 });
  }
  const from = new Date(fromParam);
  const to = new Date(toParam);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid from/to date" }, { status: 400 });
  }

  const events = await listEventsBetween(from, to);
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  });
  if (!assignment.ok) {
    return NextResponse.json({ error: assignment.error }, { status: assignment.httpStatus });
  }

  const event = await createEvent({
    title,
    description,
    type,
    isTentative,
    startAt,
    endAt,
    createdBy: session.uid,
    assigneeId: assignment.assigneeId,
    status: assignment.status,
  });

  const recipients = await getAllRecipientEmails();
  const { subject, html } = eventCreatedEmail(event);
  sendMailInBackground({ to: recipients, subject, html });

  return NextResponse.json({ event }, { status: 201 });
}
