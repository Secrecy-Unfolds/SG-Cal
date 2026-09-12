import { query } from "@/lib/db";
import type { LeaveStatus } from "@/lib/hrDisplay";

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
  department: string;
  join_date: string | null; // "YYYY-MM-DD"
  salary: string | null; // numeric comes back as a string from pg
  salary_currency: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  updated_at: Date | null;
};

// LEFT JOIN + COALESCE so every user has a row here even before an Admin has
// ever saved employee_details for them — no backfill migration needed.
const EMPLOYEE_SELECT = `
  SELECT u.id AS user_id, u.username, u.name,
         COALESCE(ed.position, '') AS position,
         COALESCE(ed.department, '') AS department,
         ed.join_date,
         ed.salary,
         COALESCE(ed.salary_currency, 'OMR') AS salary_currency,
         COALESCE(ed.emergency_contact_name, '') AS emergency_contact_name,
         COALESCE(ed.emergency_contact_phone, '') AS emergency_contact_phone,
         ed.updated_at
  FROM users u
  LEFT JOIN employee_details ed ON ed.user_id = u.id
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
    department: string;
    joinDate: string | null;
    salary: number | null;
    salaryCurrency: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  }
): Promise<EmployeeDetails | null> {
  await query(
    `INSERT INTO employee_details
       (user_id, position, department, join_date, salary, salary_currency, emergency_contact_name, emergency_contact_phone, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (user_id) DO UPDATE SET
       position = $2, department = $3, join_date = $4, salary = $5,
       salary_currency = $6, emergency_contact_name = $7, emergency_contact_phone = $8,
       updated_at = now()`,
    [
      userId,
      input.position,
      input.department,
      input.joinDate,
      input.salary,
      input.salaryCurrency,
      input.emergencyContactName,
      input.emergencyContactPhone,
    ]
  );
  return getEmployeeDetails(userId);
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

// ---- Attendance (self-service check-in/check-out) ----

export type AttendanceRecordRow = {
  id: number;
  user_id: number;
  username: string;
  work_date: string; // "YYYY-MM-DD"
  check_in_at: Date;
  check_out_at: Date | null;
};

const ATTENDANCE_SELECT = `
  SELECT a.id, a.user_id, u.username, a.work_date, a.check_in_at, a.check_out_at
  FROM attendance_records a
  JOIN users u ON u.id = a.user_id
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
