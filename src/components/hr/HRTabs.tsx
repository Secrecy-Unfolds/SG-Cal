"use client";

import { useState } from "react";
import UsersListClient from "@/components/UsersListClient";
import LeaveRequestsAdminClient from "@/components/hr/LeaveRequestsAdminClient";
import AttendanceAdminClient from "@/components/hr/AttendanceAdminClient";
import PublicHolidaysClient from "@/components/hr/PublicHolidaysClient";
import type { EmployeeDetails, LeaveRequestRow, AttendanceRecordRow } from "@/lib/hr";
import type { UserRole, UserSummary } from "@/lib/users";
import type { LeaveBalance, PublicHoliday } from "@/lib/hrDisplay";
import PageHeader from "@/components/hud/PageHeader";
import FolderTabs from "@/components/hud/FolderTabs";

type Tab = "users" | "leave" | "attendance" | "holidays";

export default function HRTabs({
  users,
  employees,
  leaveRequests,
  attendance,
  holidays,
  balances,
  actorRole,
  actorUid,
  isAdmin,
}: {
  users: UserSummary[];
  employees: EmployeeDetails[];
  leaveRequests: LeaveRequestRow[];
  attendance: AttendanceRecordRow[];
  holidays: PublicHoliday[];
  balances: Record<number, LeaveBalance>;
  actorRole: UserRole;
  actorUid: number;
  // Organization structure Phase 4 (0.2.18): false for a department-module
  // "hr" viewer — they get the same three tabs read-only, and never the
  // Employees tab (that one stays under Phase 5's own, more precise
  // self/Admin/hierarchical-superior rule — see the page's own comment).
  isAdmin: boolean;
}) {
  const [tab, setTab] = useState<Tab>(isAdmin ? "users" : "leave");

  const tabs: { key: Tab; label: string }[] = [
    ...(isAdmin ? [{ key: "users" as const, label: "Employees" }] : []),
    { key: "leave", label: "Leave Requests" },
    { key: "attendance", label: "Attendance" },
    { key: "holidays", label: "Public Holidays" },
  ];

  return (
    <div>
      <PageHeader label="HR" title="HR" />
      {!isAdmin && (
        <p className="text-xs text-black/50 dark:text-white/50 mb-3">
          View-only — your department gives you visibility into HR, but changes here still need an Admin.
        </p>
      )}

      <FolderTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "users" && isAdmin && (
        <UsersListClient users={users} employees={employees} actorRole={actorRole as "admin" | "super_admin"} actorUid={actorUid} />
      )}
      {tab === "leave" && (
        <LeaveRequestsAdminClient
          requests={leaveRequests}
          balances={balances}
          holidays={holidays.map((h) => h.holiday_date)}
          readOnly={!isAdmin}
        />
      )}
      {tab === "attendance" && (
        <AttendanceAdminClient
          records={attendance}
          employees={users.map((u) => ({ id: u.id, username: u.username }))}
          readOnly={!isAdmin}
        />
      )}
      {tab === "holidays" && <PublicHolidaysClient holidays={holidays} readOnly={!isAdmin} />}
    </div>
  );
}
