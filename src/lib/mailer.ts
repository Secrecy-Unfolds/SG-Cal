import { waitUntil } from "@vercel/functions";
import { query } from "@/lib/db";
import type { UserRole } from "@/lib/users";

// Default endpoint for the Google Apps Script mail relay; override with
// EMAIL_ENDPOINT_URL in .env if you ever redeploy the script elsewhere.
const DEFAULT_EMAIL_ENDPOINT_URL =
  "https://script.google.com/macros/s/AKfycbyWYYWj0urwkoFfXuAy3K2L_l_1xjy7WuKHUedlTpz8gIQbeyyS387TSD1uyw6unU1W/exec";

// EMAIL_TEST_MODE is a local-only escape hatch: set it in your own .env
// while testing so notification emails only go to the Super Admin instead
// of every real user. Never set this in production.
export async function getAllRecipientEmails(): Promise<string[]> {
  const testMode = process.env.EMAIL_TEST_MODE === "true";
  const res = await query<{ email: string }>(
    testMode
      ? "SELECT email FROM users WHERE role = 'super_admin' ORDER BY id ASC"
      : "SELECT email FROM users ORDER BY id ASC"
  );
  return res.rows.map((r) => r.email);
}

// Same shape as getAllRecipientEmails, but with id/role too — needed so the
// digest cron routes can build a per-recipient (attendee/assignee-scoped)
// event list for each user rather than one broadcast email to everyone.
export async function getAllRecipients(): Promise<{ id: number; email: string; role: UserRole }[]> {
  const testMode = process.env.EMAIL_TEST_MODE === "true";
  const res = await query<{ id: number; email: string; role: UserRole }>(
    testMode
      ? "SELECT id, email, role FROM users WHERE role = 'super_admin' ORDER BY id ASC"
      : "SELECT id, email, role FROM users ORDER BY id ASC"
  );
  return res.rows;
}

// Procurement Planning is Admin-level only, so its notifications go to
// Admins and Super Admins only — plain "user" accounts can't see that
// section at all. Same EMAIL_TEST_MODE behavior as above: only Super Admin
// while testing.
export async function getAdminLevelRecipientEmails(): Promise<string[]> {
  const testMode = process.env.EMAIL_TEST_MODE === "true";
  const res = await query<{ email: string }>(
    testMode
      ? "SELECT email FROM users WHERE role = 'super_admin' ORDER BY id ASC"
      : "SELECT email FROM users WHERE role IN ('admin', 'super_admin') ORDER BY id ASC"
  );
  return res.rows.map((r) => r.email);
}

async function sendOne(to: string, subject: string, html: string) {
  const url = process.env.EMAIL_ENDPOINT_URL || DEFAULT_EMAIL_ENDPOINT_URL;
  const token = process.env.EMAIL_TOKEN;
  const name = process.env.EMAIL_SENDER_NAME;
  if (!token) throw new Error("EMAIL_TOKEN is not set");
  if (!name) throw new Error("EMAIL_SENDER_NAME is not set");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, to, subject, body: html, name }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Email relay responded ${res.status}: ${text.slice(0, 300)}`);
  }
}

export async function sendMail(opts: { to: string[]; subject: string; html: string }) {
  if (opts.to.length === 0) return;
  // The relay's "to" field is a single address, so fire one request per recipient.
  await Promise.all(opts.to.map((addr) => sendOne(addr, opts.subject, opts.html)));
}

// For interactive routes (create/update/delete an event): the Apps Script
// relay is occasionally slow, and awaiting it before responding left the
// client's request hanging (and sometimes timing out) even though the
// underlying database change had already succeeded. waitUntil hands the
// send off to run in the background — Vercel keeps the function alive long
// enough to finish it without making the user wait on it.
export function sendMailInBackground(opts: { to: string[]; subject: string; html: string }) {
  waitUntil(sendMail(opts).catch((err) => console.error("Failed to send notification email:", err)));
}
