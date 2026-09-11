import { NextRequest, NextResponse } from "next/server";
import { generateTempPassword, getSession, hashPassword } from "@/lib/auth";
import { query } from "@/lib/db";
import { getUserById } from "@/lib/users";
import { sendMailInBackground } from "@/lib/mailer";
import { passwordResetEmail } from "@/lib/userEmailTemplates";

export const runtime = "nodejs";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "super_admin") {
    return NextResponse.json({ error: "Only the Super Admin can reset another user's password" }, { status: 403 });
  }

  const id = parseId(params.id);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  if (id === session.uid) {
    return NextResponse.json({ error: "Use Change Password to reset your own password" }, { status: 403 });
  }

  const target = await getUserById(id);
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, id]);

  const { subject, html } = passwordResetEmail(session.username, tempPassword);
  sendMailInBackground({ to: [target.email], subject, html });

  return NextResponse.json({ ok: true });
}
