"use client";

import { useState } from "react";
import UsersListClient from "@/components/UsersListClient";
import LeaveRequestsAdminClient from "@/components/hr/LeaveRequestsAdminClient";
import AttendanceAdminClient from "@/components/hr/AttendanceAdminClient";
import type { EmployeeDetails, LeaveRequestRow, AttendanceRecordRow } from "@/lib/hr";
import type { UserSummary } from "@/lib/users";
import PageHeader from "@/components/hud/PageHeader";

type Tab = "users" | "leave" | "attendance";

export default function HRTabs({
  users,
  employees,
  leaveRequests,
  attendance,
  actorRole,
  actorUid,
}: {
  users: UserSummary[];
  employees: EmployeeDetails[];
  leaveRequests: LeaveRequestRow[];
  attendance: AttendanceRecordRow[];
  actorRole: "admin" | "super_admin";
  actorUid: number;
}) {
  const [tab, setTab] = useState<Tab>("users");

  const tabs: { key: Tab; label: string }[] = [
    { key: "users", label: "Users" },
    { key: "leave", label: "Leave Requests" },
    { key: "attendance", label: "Attendance" },
  ];

  return (
    <div>
      <PageHeader label="HR" title="HR" />

      <div className="flex rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm w-fit mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md font-mono text-xs font-semibold uppercase tracking-wide transition-colors ${
              tab === t.key ? "bg-accent text-ink" : "text-black/50 dark:text-white/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <UsersListClient users={users} employees={employees} actorRole={actorRole} actorUid={actorUid} />
      )}
      {tab === "leave" && <LeaveRequestsAdminClient requests={leaveRequests} />}
      {tab === "attendance" && <AttendanceAdminClient records={attendance} />}
    </div>
  );
}
