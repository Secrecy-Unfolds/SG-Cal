import { query } from "@/lib/db";
import { getEmailsByIds } from "@/lib/users";

// Organization structure, Phase 6: recipients for the GRN / Vendor-invoice /
// payroll-run postings, per docs/org-structure-plan.md's confirmed rule —
// "the poster, Admin-level, and the Manager + Director of the department(s)
// the posting belongs to." The Manager/Director half lives here; the poster
// and Admin-level halves are each route's own existing
// getEmailsByIds([actorId]) / getAdminLevelRecipientEmails(category) calls.
//
// Manager/Director notification is deliberately NOT gated by
// lib/notificationPreferences.ts (unlike the broadcast helpers in
// lib/mailer.ts) — same "personal, not a broadcast" reasoning as
// attendanceChangedEmail/leaveRequestDecidedEmail: it's about their own
// structural responsibility (their department's spend/payroll), not a
// module-wide announcement they can opt out of. A Manager/Director may hold
// a plain "user" role, so getAdminLevelRecipientEmails alone would miss them
// even without the mute question.

// Emails of every Manager and Director across the given departments
// (deduplicated; a Director over several departments is only emailed once).
export async function getDepartmentLeadershipEmails(departmentIds: number[]): Promise<string[]> {
  const unique = Array.from(new Set(departmentIds)).filter((id) => Number.isInteger(id));
  if (unique.length === 0) return [];
  const res = await query<{ id: number }>(
    `SELECT DISTINCT id FROM (
       SELECT manager_id AS id FROM departments WHERE id = ANY($1::int[]) AND manager_id IS NOT NULL
       UNION
       SELECT director_id AS id FROM departments WHERE id = ANY($1::int[]) AND director_id IS NOT NULL
     ) t`,
    [unique]
  );
  return getEmailsByIds(res.rows.map((r) => r.id));
}

// Which department a purchase posting (GRN / Vendor Invoice) belongs to —
// confirmed 2026-09-22: the product's optional Project's Department if it
// has one, else the poster's own Department. Null if neither resolves (no
// Project link and the poster has no Department set either) — the posting
// still goes out to the poster + Admin-level, just with no extra leadership
// recipients.
export async function resolvePurchaseDepartmentId(productId: number | null, posterId: number): Promise<number | null> {
  if (productId !== null) {
    const viaProject = await query<{ department_id: number }>(
      `SELECT pr.department_id FROM procurement_products p
       JOIN projects pr ON pr.id = p.project_id
       WHERE p.id = $1`,
      [productId]
    );
    if (viaProject.rows[0]) return viaProject.rows[0].department_id;
  }
  const viaPoster = await query<{ department_id: number | null }>(
    `SELECT department_id FROM employee_details WHERE user_id = $1`,
    [posterId]
  );
  return viaPoster.rows[0]?.department_id ?? null;
}

// The distinct Departments among a set of employees (a payroll run's own
// paid employees) — a run can span several departments at once.
export async function getDepartmentIdsForUsers(userIds: number[]): Promise<number[]> {
  if (userIds.length === 0) return [];
  const res = await query<{ department_id: number }>(
    `SELECT DISTINCT department_id FROM employee_details WHERE user_id = ANY($1::int[]) AND department_id IS NOT NULL`,
    [userIds]
  );
  return res.rows.map((r) => r.department_id);
}
