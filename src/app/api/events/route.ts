import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createEvent, isEventType, listEventsBetween } from "@/lib/events";
import { sendMail, getAllRecipientEmails } from "@/lib/mailer";
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
  const startAtStr = typeof body?.startAt === "string" ? body.startAt : "";
  const endAtStr = typeof body?.endAt === "string" ? body.endAt : "";

  if (!title || !startAtStr) {
    return NextResponse.json({ error: "title and startAt are required" }, { status: 400 });
  }

  const startAt = new Date(startAtStr);
  const endAt = endAtStr ? new Date(endAtStr) : null;
  if (isNaN(startAt.getTime()) || (endAt && isNaN(endAt.getTime()))) {
    return NextResponse.json({ error: "Invalid start/end date" }, { status: 400 });
  }
  if (type === "task" && !endAt) {
    return NextResponse.json(
      { error: "Tasks need a due/end time so the 3-hours-before reminder can fire" },
      { status: 400 }
    );
  }

  const event = await createEvent({
    title,
    description,
    type,
    startAt,
    endAt,
    createdBy: session.uid,
  });

  try {
    const recipients = await getAllRecipientEmails();
    const { subject, html } = eventCreatedEmail(event);
    await sendMail({ to: recipients, subject, html });
  } catch (err) {
    console.error("Failed to send event-created email:", err);
  }

  return NextResponse.json({ event }, { status: 201 });
}
