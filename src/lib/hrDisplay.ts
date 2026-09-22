// Client-safe HR constants/types — no server-only imports, so client
// components can use these directly. Same reason eventDisplay.ts and
// procurementDisplay.ts exist (see the "recurring pattern" note in
// docs/project-structure.md): lib/hr.ts imports `query` from lib/db.ts,
// which pulls in the Node-only `pg` driver.

export type LeaveStatus = "pending" | "approved" | "rejected";

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const LEAVE_STATUS_BADGE_CLASS: Record<LeaveStatus, string> = {
  pending: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
  approved: "bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-300",
  rejected: "bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300",
};

export function isLeaveStatus(value: unknown): value is LeaveStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

// ---- Leave days / balance (0.2.11) ----
// Days are counted Sunday-Thursday: Friday and Saturday are the weekend, and
// admin-maintained public holidays are skipped too. Pure (no DB) so the
// request form can preview a count and the server can compute the same one.

export type PublicHoliday = { id: number; holiday_date: string; name: string };

const DAY_MS = 86_400_000;

function dateToUtcMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function isWeekend(utcMs: number): boolean {
  const dow = new Date(utcMs).getUTCDay();
  return dow === 5 || dow === 6; // Fri, Sat
}

export function countLeaveDays(start: string, end: string, holidayDates: readonly string[]): number {
  const holidays = new Set(holidayDates);
  const endMs = dateToUtcMs(end);
  let count = 0;
  // The iteration cap only guards against a pathological range; a real
  // request is days long.
  for (let t = dateToUtcMs(start), i = 0; t <= endMs && i < 3700; t += DAY_MS, i++) {
    if (isWeekend(t)) continue;
    if (holidays.has(new Date(t).toISOString().slice(0, 10))) continue;
    count++;
  }
  return count;
}

export type LeaveBalance = {
  year: number;
  allowance: number | null; // null = no allowance set for this employee
  used: number; // approved working days falling in `year`
  pending: number; // pending working days falling in `year` (not deducted)
  remaining: number | null; // allowance - used; null when there's no allowance
};

// Working days of [start, end] that fall inside calendar year `year` — a
// request spanning New Year counts each side toward its own year.
export function countLeaveDaysInYear(start: string, end: string, holidayDates: readonly string[], year: number): number {
  const from = start > `${year}-01-01` ? start : `${year}-01-01`;
  const to = end < `${year}-12-31` ? end : `${year}-12-31`;
  if (from > to) return 0;
  return countLeaveDays(from, to, holidayDates);
}

export function computeLeaveBalance(
  allowance: number | null,
  requests: { start_date: string; end_date: string; status: LeaveStatus }[],
  holidayDates: readonly string[],
  year: number
): LeaveBalance {
  let used = 0;
  let pending = 0;
  for (const r of requests) {
    if (r.status === "rejected") continue;
    const days = countLeaveDaysInYear(r.start_date, r.end_date, holidayDates, year);
    if (r.status === "approved") used += days;
    else pending += days;
  }
  return { year, allowance, used, pending, remaining: allowance === null ? null : allowance - used };
}

export function formatDays(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)} day${n === 1 ? "" : "s"}`;
}

// ---- Richer employee details + documents (0.2.17, Organization structure
// Phase 5) ----

export const EMPLOYEE_DOCUMENT_TYPES = ["civil_id", "passport", "visa", "contract", "degree", "other"] as const;
export type EmployeeDocumentType = (typeof EMPLOYEE_DOCUMENT_TYPES)[number];

export const EMPLOYEE_DOCUMENT_TYPE_LABELS: Record<EmployeeDocumentType, string> = {
  civil_id: "Civil ID",
  passport: "Passport",
  visa: "Visa",
  contract: "Contract",
  degree: "Degree",
  other: "Other",
};

export function isEmployeeDocumentType(value: unknown): value is EmployeeDocumentType {
  return EMPLOYEE_DOCUMENT_TYPES.includes(value as EmployeeDocumentType);
}

export type EmployeeDocumentRow = {
  id: number;
  user_id: number;
  doc_type: EmployeeDocumentType;
  version_number: number;
  blob_url: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by_username: string | null;
  uploaded_at: string; // ISO
};

// A reminder fires once an expiry is within this many days (confirmed
// 2026-09-22) — same lead time for Civil ID, Passport, Visa, and Contract.
export const EXPIRY_REMINDER_LEAD_DAYS = 60;

// Fields hidden from everyone except: the employee themselves, Admin-level,
// or someone strictly above them in the reporting chain (confirmed
// 2026-09-22 — "sensitive-field visibility is hierarchical, not a flat
// Admin-level gate"). Kept here as the single list the UI badges against;
// the actual enforcement/redaction happens server-side in lib/hr.ts, which
// additionally always excludes salary/annual_leave_days from a hierarchical
// (non-Admin-level, non-self) viewer — those stay Admin-level-only, a
// separate and unchanged rule.
export const SENSITIVE_EMPLOYEE_FIELDS = [
  "civil_id",
  "civil_id_expiry",
  "passport_number",
  "passport_expiry",
  "visa_expiry",
  "father_name",
  "religion",
  "date_of_birth",
] as const;

// Whether `country` (free text) implies visa fields matter — expat status is
// derived from it rather than a separate flag (confirmed 2026-09-22).
export function isExpatCountry(country: string): boolean {
  const c = country.trim().toLowerCase();
  return c !== "" && c !== "oman";
}
