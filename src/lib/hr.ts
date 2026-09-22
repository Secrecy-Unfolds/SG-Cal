import { query } from "@/lib/db";
import { del } from "@vercel/blob";
import {
  computeLeaveBalance,
  EXPIRY_REMINDER_LEAD_DAYS,
  type EmployeeDocumentRow,
  type EmployeeDocumentType,
  type LeaveBalance,
  type LeaveStatus,
  type PublicHoliday,
} from "@/lib/hrDisplay";
import { toMuscatDateInput } from "@/lib/time";
import { resolveEmployeeOrgAssignment } from "@/lib/org";
import { getSubordinateIds, loadOrgSnapshot } from "@/lib/orgHierarchy";
import type { StructuralKey } from "@/lib/orgDisplay";
import { isAdminLevel, type UserRole } from "@/lib/users";

// Single source of truth lives in hrDisplay.ts (client-safe — no server-only
// imports), so client components can use it directly without pulling in `pg`.
export type { LeaveStatus } from "@/lib/hrDisplay";
export { LEAVE_STATUS_LABELS, LEAVE_STATUS_BADGE_CLASS, isLeaveStatus } from "@/lib/hrDisplay";

// ---- Employee details (1:1 extension of users) ----

export type EmployeeDetails = {
  user_id: number;
  username: string;
  name: string;
  position: string;
  // The Department's name ('' if none) — from the managed departments list.
  department: string;
  department_id: number | null;
  job_title_id: number | null;
  job_title: string | null;
  job_title_qualified: boolean; // shown as "<Department> <title>"
  job_title_key: StructuralKey | null;
  // Only meaningful for a Director: the Chief Officer they report to.
  reports_to_id: number | null;
  reports_to_username: string | null;
  // The Department this person is the Manager of, and how many they are the
  // Director of — when set, their Department/title come from that role and
  // aren't editable on the employee record.
  managed_department_id: number | null;
  directed_department_count: number;
  headed_project_count: number; // Projects they are the Head of
  leads_team: boolean; // they are a Team's Lead
  join_date: string | null; // "YYYY-MM-DD"
  salary: string | null; // numeric comes back as a string from pg
  salary_currency: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  annual_leave_days: string | null; // numeric comes back as a string; null = no allowance set
  // Richer details (0.2.17, Organization structure Phase 5). The six marked
  // "sensitive" (see hrDisplay.ts's SENSITIVE_EMPLOYEE_FIELDS) are only ever
  // populated for: the employee themselves, Admin-level, or someone strictly
  // above them in the reporting chain — see redactForHierarchicalView below.
  // Everyone else gets a 403 for the whole record (unchanged from before).
  civil_id: string; // sensitive
  civil_id_expiry: string | null; // sensitive
  passport_number: string; // sensitive
  passport_expiry: string | null; // sensitive
  visa_expiry: string | null; // sensitive — only meaningful if country isn't Oman
  contract_expiry: string | null;
  father_name: string; // sensitive
  religion: string; // sensitive
  country: string;
  date_of_birth: string | null; // sensitive
  gender: string;
  education_level: string;
  degree_field: string;
  graduation_date: string | null;
  years_experience: string | null; // numeric comes back as a string
  recommended_by: string;
  updated_at: Date | null;
};

// LEFT JOIN + COALESCE so every user has a row here even before an Admin has
// ever saved employee_details for them — no backfill migration needed.
const EMPLOYEE_SELECT = `
  SELECT u.id AS user_id, u.username, u.name,
         COALESCE(ed.position, '') AS position,
         COALESCE(d.name, '') AS department,
         ed.department_id,
         ed.job_title_id, jt.name AS job_title,
         COALESCE(jt.qualified_by_department, false) AS job_title_qualified,
         jt.structural_key AS job_title_key,
         ed.reports_to_id, ru.username AS reports_to_username,
         (SELECT dm.id FROM departments dm WHERE dm.manager_id = u.id) AS managed_department_id,
         (SELECT COUNT(*)::int FROM departments dr WHERE dr.director_id = u.id) AS directed_department_count,
         (SELECT COUNT(*)::int FROM projects pj WHERE pj.project_head_id = u.id) AS headed_project_count,
         EXISTS (SELECT 1 FROM teams tl WHERE tl.team_lead_id = u.id) AS leads_team,
         ed.join_date,
         ed.salary,
         COALESCE(ed.salary_currency, 'OMR') AS salary_currency,
         COALESCE(ed.emergency_contact_name, '') AS emergency_contact_name,
         COALESCE(ed.emergency_contact_phone, '') AS emergency_contact_phone,
         ed.annual_leave_days,
         COALESCE(ed.civil_id, '') AS civil_id, ed.civil_id_expiry,
         COALESCE(ed.passport_number, '') AS passport_number, ed.passport_expiry,
         ed.visa_expiry, ed.contract_expiry,
         COALESCE(ed.father_name, '') AS father_name,
         COALESCE(ed.religion, '') AS religion,
         COALESCE(ed.country, '') AS country,
         ed.date_of_birth,
         COALESCE(ed.gender, '') AS gender,
         COALESCE(ed.education_level, '') AS education_level,
         COALESCE(ed.degree_field, '') AS degree_field,
         ed.graduation_date,
         ed.years_experience,
         COALESCE(ed.recommended_by, '') AS recommended_by,
         ed.updated_at
  FROM users u
  LEFT JOIN employee_details ed ON ed.user_id = u.id
  LEFT JOIN departments d ON d.id = ed.department_id
  LEFT JOIN job_titles jt ON jt.id = ed.job_title_id
  LEFT JOIN users ru ON ru.id = ed.reports_to_id
`;

export async function listEmployeesWithDetails(): Promise<EmployeeDetails[]> {
  const res = await query<EmployeeDetails>(`${EMPLOYEE_SELECT} ORDER BY u.username ASC`);
  return res.rows;
}

export async function getEmployeeDetails(userId: number): Promise<EmployeeDetails | null> {
  const res = await query<EmployeeDetails>(`${EMPLOYEE_SELECT} WHERE u.id = $1`, [userId]);
  return res.rows[0] ?? null;
}

export async function upsertEmployeeDetails(
  userId: number,
  input: {
    position: string;
    departmentId: number | null;
    jobTitleId: number | null;
    reportsToId: number | null;
    joinDate: string | null;
    salary: number | null;
    salaryCurrency: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    annualLeaveDays: number | null;
    civilId: string;
    civilIdExpiry: string | null;
    passportNumber: string;
    passportExpiry: string | null;
    visaExpiry: string | null;
    contractExpiry: string | null;
    fatherName: string;
    religion: string;
    country: string;
    dateOfBirth: string | null;
    gender: string;
    educationLevel: string;
    degreeField: string;
    graduationDate: string | null;
    yearsExperience: number | null;
    recommendedBy: string;
  }
): Promise<{ ok: true; employee: EmployeeDetails } | { ok: false; error: string; notFound?: boolean }> {
  const existing = await getEmployeeDetails(userId);
  if (!existing) return { ok: false, error: "User not found", notFound: true };

  // Department / title / reports-to go through the structure rules
  // (lib/org.ts): a Department's Manager/Director keep the role-driven
  // department and title, structure-controlled titles can't be hand-picked,
  // there is one CEO, and a Director reports to a Chief Officer.
  const org = await resolveEmployeeOrgAssignment(userId, {
    departmentId: input.departmentId,
    jobTitleId: input.jobTitleId,
    reportsToId: input.reportsToId,
  });
  if (!org.ok) return { ok: false, error: org.error };

  // Each expiry's own reminder flag resets when THAT expiry date changes —
  // same "editing the due date resets the reminder" pattern as Plans'
  // overdue-step reminders (lib/planSteps.ts) — so a renewed document (or a
  // corrected typo) can be reminded about again on its new date.
  // The no-op branch's right-hand side must be table-qualified: in an
  // INSERT ... ON CONFLICT DO UPDATE, an unqualified column name on the
  // right of SET is ambiguous between the target table and the `excluded`
  // pseudo-table (both have a column of that name) — Postgres rejects it.
  const resetIf = (changed: boolean, column: string) =>
    changed ? `${column} = NULL` : `${column} = employee_details.${column}`;
  const civilIdChanged = input.civilIdExpiry !== existing.civil_id_expiry;
  const passportChanged = input.passportExpiry !== existing.passport_expiry;
  const visaChanged = input.visaExpiry !== existing.visa_expiry;
  const contractChanged = input.contractExpiry !== existing.contract_expiry;

  // The old free-text `department` column is deliberately not written any
  // more (department_id replaces it).
  await query(
    `INSERT INTO employee_details
       (user_id, position, department_id, job_title_id, reports_to_id, join_date, salary, salary_currency,
        emergency_contact_name, emergency_contact_phone, annual_leave_days,
        civil_id, civil_id_expiry, passport_number, passport_expiry, visa_expiry, contract_expiry,
        father_name, religion, country, date_of_birth, gender, education_level, degree_field,
        graduation_date, years_experience, recommended_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, now())
     ON CONFLICT (user_id) DO UPDATE SET
       position = $2, department_id = $3, job_title_id = $4, reports_to_id = $5, join_date = $6, salary = $7,
       salary_currency = $8, emergency_contact_name = $9, emergency_contact_phone = $10,
       annual_leave_days = $11,
       civil_id = $12, civil_id_expiry = $13, passport_number = $14, passport_expiry = $15,
       visa_expiry = $16, contract_expiry = $17, father_name = $18, religion = $19, country = $20,
       date_of_birth = $21, gender = $22, education_level = $23, degree_field = $24,
       graduation_date = $25, years_experience = $26, recommended_by = $27,
       ${resetIf(civilIdChanged, "civil_id_expiry_reminder_sent_at")},
       ${resetIf(passportChanged, "passport_expiry_reminder_sent_at")},
       ${resetIf(visaChanged, "visa_expiry_reminder_sent_at")},
       ${resetIf(contractChanged, "contract_expiry_reminder_sent_at")},
       updated_at = now()`,
    [
      userId,
      input.position,
      org.departmentId,
      org.jobTitleId,
      org.reportsToId,
      input.joinDate,
      input.salary,
      input.salaryCurrency,
      input.emergencyContactName,
      input.emergencyContactPhone,
      input.annualLeaveDays,
      input.civilId,
      input.civilIdExpiry,
      input.passportNumber,
      input.passportExpiry,
      input.visaExpiry,
      input.contractExpiry,
      input.fatherName,
      input.religion,
      input.country,
      input.dateOfBirth,
      input.gender,
      input.educationLevel,
      input.degreeField,
      input.graduationDate,
      input.yearsExperience,
      input.recommendedBy,
    ]
  );
  const employee = await getEmployeeDetails(userId);
  return employee ? { ok: true, employee } : { ok: false, error: "User not found", notFound: true };
}

// ---- Hierarchical read access (0.2.17) ----
//
// Who may read a FULL employee record (self, Admin-level, or a strict
// superior in the reporting chain get everything, including the sensitive
// fields — "hierarchical, not a flat Admin-level gate," confirmed
// 2026-09-22) vs. a 403 (unrelated peer/subordinate/other). Salary and the
// leave allowance stay a SEPARATE, unchanged rule — Admin-level (or self)
// only, never shown to a hierarchical superior who isn't also Admin-level.

const TEAM_VIEW_EXCLUDED: (keyof EmployeeDetails)[] = ["salary", "annual_leave_days"];

function redactForHierarchicalView(employee: EmployeeDetails): EmployeeDetails {
  const copy = { ...employee };
  for (const field of TEAM_VIEW_EXCLUDED) (copy as any)[field] = null;
  return copy;
}

export type EmployeeViewResult =
  | { ok: true; employee: EmployeeDetails; isHierarchicalView: boolean }
  | { ok: false; reason: "not_found" | "forbidden" };

export async function getEmployeeDetailsForViewer(
  targetUserId: number,
  viewerId: number,
  viewerRole: UserRole
): Promise<EmployeeViewResult> {
  const employee = await getEmployeeDetails(targetUserId);
  if (!employee) return { ok: false, reason: "not_found" };

  if (targetUserId === viewerId || isAdminLevel(viewerRole)) {
    return { ok: true, employee, isHierarchicalView: false };
  }
  const snapshot = await loadOrgSnapshot();
  if (getSubordinateIds(snapshot, viewerId).includes(targetUserId)) {
    return { ok: true, employee: redactForHierarchicalView(employee), isHierarchicalView: true };
  }
  return { ok: false, reason: "forbidden" };
}

// Everyone below `viewerId` in the reporting chain, with their basic details
// — the "My Team" list (Profile page). Empty for someone with no
// subordinates (most employees).
export async function listSubordinatesWithDetails(viewerId: number): Promise<EmployeeDetails[]> {
  const snapshot = await loadOrgSnapshot();
  const ids = getSubordinateIds(snapshot, viewerId);
  if (ids.length === 0) return [];
  const res = await query<EmployeeDetails>(`${EMPLOYEE_SELECT} WHERE u.id = ANY($1::int[]) ORDER BY u.username ASC`, [
    ids,
  ]);
  return res.rows.map(redactForHierarchicalView);
}

// ---- Documents (0.2.17) ----
// One logical "slot" per (user_id, doc_type); a re-upload adds a new
// version rather than overwriting (confirmed 2026-09-18) — "current" is
// MAX(version_number), computed live (mirrors lib/planDeliverables.ts's
// step_deliverable_files). Writes (upload/delete) are Admin-level-only,
// matching every other employee_details write; reads follow the same
// self/Admin-level/hierarchical-superior rule as the record itself
// (enforced by the caller, same as getEmployeeDetailsForViewer).

const DOCUMENT_SELECT = `
  SELECT d.id, d.user_id, d.doc_type, d.version_number, d.blob_url, d.file_name, d.mime_type, d.size_bytes,
         u.username AS uploaded_by_username, d.uploaded_at
  FROM employee_documents d
  LEFT JOIN users u ON u.id = d.uploaded_by
`;

export async function listEmployeeDocuments(userId: number): Promise<EmployeeDocumentRow[]> {
  const res = await query<EmployeeDocumentRow>(
    `${DOCUMENT_SELECT} WHERE d.user_id = $1 ORDER BY d.doc_type ASC, d.version_number DESC`,
    [userId]
  );
  return res.rows;
}

export async function addEmployeeDocument(input: {
  userId: number;
  docType: EmployeeDocumentType;
  blobUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: number;
}): Promise<EmployeeDocumentRow> {
  const nextVersion = await query<{ next: number }>(
    `SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM employee_documents WHERE user_id = $1 AND doc_type = $2`,
    [input.userId, input.docType]
  );
  const res = await query<{ id: number }>(
    `INSERT INTO employee_documents (user_id, doc_type, version_number, blob_url, file_name, mime_type, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      input.userId,
      input.docType,
      nextVersion.rows[0].next,
      input.blobUrl,
      input.fileName,
      input.mimeType,
      input.sizeBytes,
      input.uploadedBy,
    ]
  );
  const created = await query<EmployeeDocumentRow>(`${DOCUMENT_SELECT} WHERE d.id = $1`, [res.rows[0].id]);
  return created.rows[0];
}

export async function getEmployeeDocument(id: number): Promise<{ id: number; user_id: number; blob_url: string } | null> {
  const res = await query<{ id: number; user_id: number; blob_url: string }>(
    `SELECT id, user_id, blob_url FROM employee_documents WHERE id = $1`,
    [id]
  );
  return res.rows[0] ?? null;
}

export async function deleteEmployeeDocument(id: number): Promise<void> {
  const doc = await getEmployeeDocument(id);
  if (!doc) return;
  await query(`DELETE FROM employee_documents WHERE id = $1`, [id]);
  await del(doc.blob_url).catch(() => {});
}

// ---- Expiry reminders (0.2.17) ----
// Fires once per expiry VALUE (reset on edit, see upsertEmployeeDetails
// above) once it's within EXPIRY_REMINDER_LEAD_DAYS — no lower bound, so an
// already-passed expiry the sweep never caught still gets one reminder
// rather than being silently skipped.

export type ExpiringDocumentReminder = {
  user_id: number;
  username: string;
  kind: "civil_id" | "passport" | "visa" | "contract";
  expiry_date: string;
};

export async function listExpiringDocumentsNeedingReminder(): Promise<ExpiringDocumentReminder[]> {
  const res = await query<ExpiringDocumentReminder>(
    `SELECT ed.user_id, u.username, 'civil_id' AS kind, ed.civil_id_expiry AS expiry_date
       FROM employee_details ed JOIN users u ON u.id = ed.user_id
       WHERE ed.civil_id_expiry IS NOT NULL AND ed.civil_id_expiry_reminder_sent_at IS NULL
         AND ed.civil_id_expiry <= (current_date + $1 * interval '1 day')
     UNION ALL
     SELECT ed.user_id, u.username, 'passport', ed.passport_expiry
       FROM employee_details ed JOIN users u ON u.id = ed.user_id
       WHERE ed.passport_expiry IS NOT NULL AND ed.passport_expiry_reminder_sent_at IS NULL
         AND ed.passport_expiry <= (current_date + $1 * interval '1 day')
     UNION ALL
     SELECT ed.user_id, u.username, 'visa', ed.visa_expiry
       FROM employee_details ed JOIN users u ON u.id = ed.user_id
       WHERE ed.visa_expiry IS NOT NULL AND ed.visa_expiry_reminder_sent_at IS NULL
         AND ed.country <> '' AND lower(ed.country) <> 'oman'
         AND ed.visa_expiry <= (current_date + $1 * interval '1 day')
     UNION ALL
     SELECT ed.user_id, u.username, 'contract', ed.contract_expiry
       FROM employee_details ed JOIN users u ON u.id = ed.user_id
       WHERE ed.contract_expiry IS NOT NULL AND ed.contract_expiry_reminder_sent_at IS NULL
         AND ed.contract_expiry <= (current_date + $1 * interval '1 day')
     ORDER BY expiry_date ASC`,
    [EXPIRY_REMINDER_LEAD_DAYS]
  );
  return res.rows;
}

export async function markExpiryReminderSent(userId: number, kind: ExpiringDocumentReminder["kind"]): Promise<void> {
  const column = `${kind}_expiry_reminder_sent_at`;
  await query(`UPDATE employee_details SET ${column} = now() WHERE user_id = $1`, [userId]);
}

// ---- Leave requests ----

export type LeaveRequestRow = {
  id: number;
  user_id: number;
  username: string;
  start_date: string; // "YYYY-MM-DD"
  end_date: string;
  reason: string;
  status: LeaveStatus;
  decided_by: number | null;
  decided_by_username: string | null;
  decided_at: Date | null;
  created_at: Date;
};

const LEAVE_SELECT = `
  SELECT lr.id, lr.user_id, u.username, lr.start_date, lr.end_date, lr.reason, lr.status,
         lr.decided_by, du.username AS decided_by_username, lr.decided_at, lr.created_at
  FROM leave_requests lr
  JOIN users u ON u.id = lr.user_id
  LEFT JOIN users du ON du.id = lr.decided_by
`;

export async function createLeaveRequest(input: {
  userId: number;
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<LeaveRequestRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO leave_requests (user_id, start_date, end_date, reason) VALUES ($1, $2, $3, $4) RETURNING id`,
    [input.userId, input.startDate, input.endDate, input.reason]
  );
  const created = await getLeaveRequestById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created leave request");
  return created;
}

export async function getLeaveRequestById(id: number): Promise<LeaveRequestRow | null> {
  const res = await query<LeaveRequestRow>(`${LEAVE_SELECT} WHERE lr.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function listLeaveRequestsForUser(userId: number): Promise<LeaveRequestRow[]> {
  const res = await query<LeaveRequestRow>(
    `${LEAVE_SELECT} WHERE lr.user_id = $1 ORDER BY lr.created_at DESC`,
    [userId]
  );
  return res.rows;
}

export async function listAllLeaveRequests(): Promise<LeaveRequestRow[]> {
  const res = await query<LeaveRequestRow>(`${LEAVE_SELECT} ORDER BY lr.created_at DESC`);
  return res.rows;
}

export async function decideLeaveRequest(
  id: number,
  input: { status: "approved" | "rejected"; decidedBy: number }
): Promise<LeaveRequestRow | null> {
  await query(
    `UPDATE leave_requests SET status = $1, decided_by = $2, decided_at = now() WHERE id = $3`,
    [input.status, input.decidedBy, id]
  );
  return getLeaveRequestById(id);
}

export async function deleteLeaveRequest(id: number): Promise<void> {
  await query(`DELETE FROM leave_requests WHERE id = $1`, [id]);
}

// ---- Public holidays + leave balance (0.2.11) ----

export async function listPublicHolidays(): Promise<PublicHoliday[]> {
  const res = await query<PublicHoliday>(
    `SELECT id, holiday_date, name FROM public_holidays ORDER BY holiday_date ASC`
  );
  return res.rows;
}

// Adds one row per day in [fromDate, toDate] (inclusive) sharing `name` — a
// multi-day holiday like Eid is entered once as a range. A day that's already
// a holiday is left as it is (its existing name is kept). Returns how many
// new days were actually added.
export async function addPublicHolidays(input: {
  fromDate: string;
  toDate: string;
  name: string;
  createdBy: number;
}): Promise<number> {
  const days: string[] = [];
  const [y, m, d] = input.fromDate.split("-").map(Number);
  for (let t = Date.UTC(y, m - 1, d), i = 0; i < 31; t += 86_400_000, i++) {
    const key = new Date(t).toISOString().slice(0, 10);
    if (key > input.toDate) break;
    days.push(key);
  }
  let added = 0;
  for (const day of days) {
    const res = await query(
      `INSERT INTO public_holidays (holiday_date, name, created_by) VALUES ($1, $2, $3)
       ON CONFLICT (holiday_date) DO NOTHING`,
      [day, input.name, input.createdBy]
    );
    added += res.rowCount ?? 0;
  }
  return added;
}

export async function deletePublicHoliday(id: number): Promise<void> {
  await query(`DELETE FROM public_holidays WHERE id = $1`, [id]);
}

// One employee's balance for a calendar year (Muscat's current year by
// default). `allowance` is null until an Admin sets one on their HR record.
export async function getLeaveBalance(userId: number, year?: number): Promise<LeaveBalance> {
  const y = year ?? Number(toMuscatDateInput(new Date()).slice(0, 4));
  const [employee, requests, holidays] = await Promise.all([
    getEmployeeDetails(userId),
    listLeaveRequestsForUser(userId),
    listPublicHolidays(),
  ]);
  const allowance = employee?.annual_leave_days != null ? Number(employee.annual_leave_days) : null;
  return computeLeaveBalance(allowance, requests, holidays.map((h) => h.holiday_date), y);
}

// Every employee's balance at once (the /hr Leave Requests tab) — three
// queries total instead of three per employee.
export async function getLeaveBalancesForAll(year?: number): Promise<Record<number, LeaveBalance>> {
  const y = year ?? Number(toMuscatDateInput(new Date()).slice(0, 4));
  const [employees, requests, holidays] = await Promise.all([
    listEmployeesWithDetails(),
    listAllLeaveRequests(),
    listPublicHolidays(),
  ]);
  const holidayDates = holidays.map((h) => h.holiday_date);
  const result: Record<number, LeaveBalance> = {};
  for (const e of employees) {
    const allowance = e.annual_leave_days != null ? Number(e.annual_leave_days) : null;
    result[e.user_id] = computeLeaveBalance(
      allowance,
      requests.filter((r) => r.user_id === e.user_id),
      holidayDates,
      y
    );
  }
  return result;
}

// ---- Attendance (self-service check-in/check-out) ----

export type AttendanceRecordRow = {
  id: number;
  user_id: number;
  username: string;
  work_date: string; // "YYYY-MM-DD"
  check_in_at: Date;
  check_out_at: Date | null;
  // Set when an Admin added/edited this day's record (null = purely the
  // employee's own check-in/out).
  edited_by: number | null;
  edited_by_username: string | null;
  edited_at: Date | null;
};

const ATTENDANCE_SELECT = `
  SELECT a.id, a.user_id, u.username, a.work_date, a.check_in_at, a.check_out_at,
         a.edited_by, eu.username AS edited_by_username, a.edited_at
  FROM attendance_records a
  JOIN users u ON u.id = a.user_id
  LEFT JOIN users eu ON eu.id = a.edited_by
`;

export async function getAttendanceForDate(userId: number, workDate: string): Promise<AttendanceRecordRow | null> {
  const res = await query<AttendanceRecordRow>(
    `${ATTENDANCE_SELECT} WHERE a.user_id = $1 AND a.work_date = $2`,
    [userId, workDate]
  );
  return res.rows[0] ?? null;
}

// Idempotent: checking in twice on the same Muscat calendar day just returns
// the existing record rather than erroring.
export async function checkIn(userId: number, workDate: string): Promise<AttendanceRecordRow> {
  await query(
    `INSERT INTO attendance_records (user_id, work_date, check_in_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id, work_date) DO NOTHING`,
    [userId, workDate]
  );
  const record = await getAttendanceForDate(userId, workDate);
  if (!record) throw new Error("Failed to check in");
  return record;
}

// No-ops (leaves check_out_at untouched) if there's no check-in yet, or a
// check-out is already recorded — the route surfaces both as a 400.
export async function checkOut(userId: number, workDate: string): Promise<AttendanceRecordRow | null> {
  await query(
    `UPDATE attendance_records SET check_out_at = now()
     WHERE user_id = $1 AND work_date = $2 AND check_out_at IS NULL`,
    [userId, workDate]
  );
  return getAttendanceForDate(userId, workDate);
}

export async function listAttendanceForUser(userId: number): Promise<AttendanceRecordRow[]> {
  const res = await query<AttendanceRecordRow>(
    `${ATTENDANCE_SELECT} WHERE a.user_id = $1 ORDER BY a.work_date DESC`,
    [userId]
  );
  return res.rows;
}

export async function listAllAttendance(): Promise<AttendanceRecordRow[]> {
  const res = await query<AttendanceRecordRow>(`${ATTENDANCE_SELECT} ORDER BY a.work_date DESC, u.username ASC`);
  return res.rows;
}

// ---- Admin-side attendance management (0.2.12) ----
// Any Admin-level can add, edit or remove anyone's record (confirmed
// 2026-09-15 — mirrors the salary-visibility rule). A day with no row is an
// absence, so "mark absent" is simply removing the row.

export async function getAttendanceById(id: number): Promise<AttendanceRecordRow | null> {
  const res = await query<AttendanceRecordRow>(`${ATTENDANCE_SELECT} WHERE a.id = $1`, [id]);
  return res.rows[0] ?? null;
}

function validateAttendanceTimes(
  workDate: string,
  checkInAt: Date,
  checkOutAt: Date | null
): string | null {
  if (toMuscatDateInput(checkInAt) !== workDate) return "The check-in time must be on the record's date";
  if (checkOutAt) {
    if (toMuscatDateInput(checkOutAt) !== workDate) return "The check-out time must be on the record's date";
    if (checkOutAt.getTime() <= checkInAt.getTime()) return "Check-out must be after check-in";
  }
  return null;
}

export async function adminCreateAttendance(input: {
  userId: number;
  workDate: string;
  checkInAt: Date;
  checkOutAt: Date | null;
  editedBy: number;
}): Promise<{ ok: true; record: AttendanceRecordRow } | { ok: false; error: string }> {
  if (input.workDate > toMuscatDateInput(new Date())) {
    return { ok: false, error: "Attendance can't be recorded for a future date" };
  }
  const timeError = validateAttendanceTimes(input.workDate, input.checkInAt, input.checkOutAt);
  if (timeError) return { ok: false, error: timeError };

  const user = await query<{ id: number }>(`SELECT id FROM users WHERE id = $1`, [input.userId]);
  if (user.rows.length === 0) return { ok: false, error: "Employee not found" };

  const res = await query<{ id: number }>(
    `INSERT INTO attendance_records (user_id, work_date, check_in_at, check_out_at, edited_by, edited_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id, work_date) DO NOTHING
     RETURNING id`,
    [input.userId, input.workDate, input.checkInAt, input.checkOutAt, input.editedBy]
  );
  if (res.rows.length === 0) {
    return { ok: false, error: "That employee already has a record for that date — edit it instead" };
  }
  const record = await getAttendanceById(res.rows[0].id);
  if (!record) throw new Error("Failed to load created attendance record");
  return { ok: true, record };
}

// The employee and date of a record are fixed; only its times change (to
// move a record to another day, remove it and add a new one).
export async function adminUpdateAttendance(
  id: number,
  input: { checkInAt: Date; checkOutAt: Date | null; editedBy: number }
): Promise<{ ok: true; record: AttendanceRecordRow } | { ok: false; error: string; notFound?: boolean }> {
  const existing = await getAttendanceById(id);
  if (!existing) return { ok: false, error: "Not found", notFound: true };
  const timeError = validateAttendanceTimes(existing.work_date, input.checkInAt, input.checkOutAt);
  if (timeError) return { ok: false, error: timeError };

  await query(
    `UPDATE attendance_records SET check_in_at = $1, check_out_at = $2, edited_by = $3, edited_at = now() WHERE id = $4`,
    [input.checkInAt, input.checkOutAt, input.editedBy, id]
  );
  const record = await getAttendanceById(id);
  if (!record) return { ok: false, error: "Not found", notFound: true };
  return { ok: true, record };
}

export async function adminDeleteAttendance(id: number): Promise<void> {
  await query(`DELETE FROM attendance_records WHERE id = $1`, [id]);
}
