"use client";

import { useEffect, useState } from "react";
import LeaveRequestModal from "@/components/LeaveRequestModal";
import ConfirmModal from "@/components/ConfirmModal";
import EmployeeDocumentsPanel from "@/components/hr/EmployeeDocumentsPanel";
import { HudFrame } from "@/components/hud/HudFrame";
import type { AttendanceRecordRow, EmployeeDetails, LeaveRequestRow } from "@/lib/hr";
import {
  LEAVE_STATUS_BADGE_CLASS,
  LEAVE_STATUS_LABELS,
  countLeaveDays,
  formatDays,
  type LeaveBalance,
} from "@/lib/hrDisplay";
import { formatDateOnly, formatMoney } from "@/lib/procurementDisplay";
import { formatMuscatDateTime, toMuscatDateInput } from "@/lib/time";

export default function MyHRCard({ userId }: { userId: number }) {
  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const [requests, setRequests] = useState<LeaveRequestRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecordRow[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [cancelingRequest, setCancelingRequest] = useState<LeaveRequestRow | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [empRes, reqRes, attRes, balRes] = await Promise.all([
        fetch(`/api/hr/employees/${userId}`),
        fetch("/api/hr/leave-requests"),
        fetch("/api/hr/attendance"),
        fetch("/api/hr/leave-balance"),
      ]);
      const empData = await empRes.json().catch(() => ({}));
      const reqData = await reqRes.json().catch(() => ({}));
      const attData = await attRes.json().catch(() => ({}));
      const balData = await balRes.json().catch(() => ({}));
      setBalance(balRes.ok ? balData.balance ?? null : null);
      setHolidays(balRes.ok ? balData.holidays ?? [] : []);
      setEmployee(empRes.ok ? empData.employee ?? null : null);
      setRequests(reqRes.ok ? reqData.requests ?? [] : []);
      setAttendance(attRes.ok ? attData.records ?? [] : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayKey = toMuscatDateInput(new Date());
  const today = attendance.find((a) => a.work_date === todayKey);

  async function handleCheckIn() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/hr/attendance/check-in", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to check in");
        return;
      }
      await loadAll();
    } finally {
      setWorking(false);
    }
  }

  async function handleCheckOut() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/hr/attendance/check-out", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to check out");
        return;
      }
      await loadAll();
    } finally {
      setWorking(false);
    }
  }

  async function handleCancelRequest() {
    if (!cancelingRequest) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/hr/leave-requests/${cancelingRequest.id}`, { method: "DELETE" });
      if (res.ok) {
        setCancelingRequest(null);
        await loadAll();
      }
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <HudFrame corners="all" className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-6">
        <p className="text-sm text-black/40 dark:text-white/40">Loading…</p>
      </HudFrame>
    );
  }

  return (
    <HudFrame corners="all" className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-5">
      <h2 className="font-heading font-semibold text-sm uppercase tracking-wide">My HR</h2>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {employee && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Position</div>
            <div>{employee.position || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Department</div>
            <div>{employee.department || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Job title</div>
            <div>
              {employee.job_title
                ? employee.job_title_qualified && employee.department
                  ? `${employee.department} ${employee.job_title}`
                  : employee.job_title
                : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Join date</div>
            <div>{formatDateOnly(employee.join_date)}</div>
          </div>
          <div>
            <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Salary</div>
            <div>{formatMoney(employee.salary, employee.salary_currency)}</div>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">
              Emergency contact
            </div>
            <div>
              {[employee.emergency_contact_name, employee.emergency_contact_phone].filter(Boolean).join(" · ") ||
                "—"}
            </div>
          </div>

          <div className="col-span-2">
            <button
              type="button"
              onClick={() => setShowMoreDetails((v) => !v)}
              className="text-xs text-accent dark:text-blue-300 hover:underline"
            >
              {showMoreDetails ? "Hide" : "Show"} personal, education &amp; document details
            </button>
          </div>

          {showMoreDetails && (
            <>
              <div>
                <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Civil ID</div>
                <div>
                  {employee.civil_id || "—"}
                  {employee.civil_id_expiry ? ` (exp. ${formatDateOnly(employee.civil_id_expiry)})` : ""}
                </div>
              </div>
              <div>
                <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Passport</div>
                <div>
                  {employee.passport_number || "—"}
                  {employee.passport_expiry ? ` (exp. ${formatDateOnly(employee.passport_expiry)})` : ""}
                </div>
              </div>
              {employee.country && employee.country.trim().toLowerCase() !== "oman" && (
                <div>
                  <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Visa expiry</div>
                  <div>{formatDateOnly(employee.visa_expiry)}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Contract expiry</div>
                <div>{formatDateOnly(employee.contract_expiry)}</div>
              </div>
              <div>
                <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Date of birth</div>
                <div>{formatDateOnly(employee.date_of_birth)}</div>
              </div>
              <div>
                <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Gender</div>
                <div>{employee.gender || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Father&rsquo;s name</div>
                <div>{employee.father_name || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Religion</div>
                <div>{employee.religion || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Country</div>
                <div>{employee.country || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Education</div>
                <div>
                  {[employee.education_level, employee.degree_field].filter(Boolean).join(" — ") || "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Graduated</div>
                <div>{formatDateOnly(employee.graduation_date)}</div>
              </div>
              <div>
                <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Experience</div>
                <div>{employee.years_experience ? `${employee.years_experience} years` : "—"}</div>
              </div>
              {employee.recommended_by && (
                <div className="col-span-2">
                  <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Recommended by</div>
                  <div>{employee.recommended_by}</div>
                </div>
              )}
              <div className="col-span-2">
                <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide mb-1">Documents</div>
                <EmployeeDocumentsPanel userId={userId} canManage={false} />
              </div>
            </>
          )}
        </div>
      )}

      <div className="border-t border-black/5 dark:border-white/10 pt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
            Attendance
          </h3>
          {!today ? (
            <span className="btn-glow inline-block">
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={working}
                className="bg-accent text-ink btn-skew px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                Check in
              </button>
            </span>
          ) : !today.check_out_at ? (
            <span className="btn-glow inline-block">
              <button
                type="button"
                onClick={handleCheckOut}
                disabled={working}
                className="bg-accent text-ink btn-skew px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                Check out
              </button>
            </span>
          ) : (
            <span className="text-xs text-black/40 dark:text-white/40">Done for today</span>
          )}
        </div>
        {attendance.length === 0 ? (
          <p className="text-xs text-black/40 dark:text-white/40">No attendance recorded yet.</p>
        ) : (
          <div className="space-y-1">
            {attendance.slice(0, 5).map((a) => (
              <div key={a.id} className="flex justify-between text-xs text-black/50 dark:text-white/50">
                <span>{formatDateOnly(a.work_date)}</span>
                <span>
                  {formatMuscatDateTime(new Date(a.check_in_at))}
                  {a.check_out_at ? ` – ${formatMuscatDateTime(new Date(a.check_out_at))}` : " – …"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-black/5 dark:border-white/10 pt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
            Leave requests
          </h3>
          <span className="btn-glow inline-block">
            <button
              type="button"
              onClick={() => setShowRequestModal(true)}
              className="btn-skew border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              + Request leave
            </button>
          </span>
        </div>
        {balance && (
          <div className="mb-3 rounded-lg bg-black/[0.03] dark:bg-white/5 px-3 py-2 text-xs">
            {balance.allowance === null ? (
              <span className="text-black/50 dark:text-white/50">
                No annual leave allowance has been set for you yet — ask an admin.
              </span>
            ) : (
              <>
                <span className="text-sm font-semibold">{formatDays(balance.remaining ?? 0)} remaining</span>
                <span className="text-black/50 dark:text-white/50">
                  {" "}
                  of {formatDays(balance.allowance)} in {balance.year} · {formatDays(balance.used)} taken
                  {balance.pending > 0 ? ` · ${formatDays(balance.pending)} pending` : ""}
                </span>
              </>
            )}
          </div>
        )}
        {requests.length === 0 ? (
          <p className="text-xs text-black/40 dark:text-white/40">No leave requests yet.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                <div>
                  <span
                    className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 mr-2 ${LEAVE_STATUS_BADGE_CLASS[r.status]}`}
                  >
                    {LEAVE_STATUS_LABELS[r.status]}
                  </span>
                  <span className="text-black/60 dark:text-white/60">
                    {formatDateOnly(r.start_date)}
                    {r.start_date !== r.end_date ? ` – ${formatDateOnly(r.end_date)}` : ""}
                  </span>
                  <span className="text-black/40 dark:text-white/40">
                    {" "}
                    · {formatDays(countLeaveDays(r.start_date, r.end_date, holidays))}
                  </span>
                </div>
                {r.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => setCancelingRequest(r)}
                    className="text-red-600 dark:text-red-400 hover:underline shrink-0"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showRequestModal && (
        <LeaveRequestModal
          balance={balance}
          holidays={holidays}
          onClose={() => setShowRequestModal(false)}
          onSaved={() => {
            setShowRequestModal(false);
            loadAll();
          }}
        />
      )}

      {cancelingRequest && (
        <ConfirmModal
          title="Cancel leave request"
          message={`Withdraw your request for ${formatDateOnly(cancelingRequest.start_date)}${
            cancelingRequest.start_date !== cancelingRequest.end_date
              ? ` – ${formatDateOnly(cancelingRequest.end_date)}`
              : ""
          }?`}
          confirmLabel="Withdraw"
          loading={working}
          onConfirm={handleCancelRequest}
          onCancel={() => setCancelingRequest(null)}
        />
      )}
    </HudFrame>
  );
}
