"use client";

import { useState } from "react";
import UsersListClient from "@/components/UsersListClient";
import LeaveRequestsAdminClient from "@/components/hr/LeaveRequestsAdminClient";
import AttendanceAdminClient from "@/components/hr/AttendanceAdminClient";
import type { EmployeeDetails, LeaveRequestRow, AttendanceRecordRow } from "@/lib/hr";
import type { UserSummary } from "@/lib/users";
import PageHeader from "@/components/hud/PageHeader";
import FolderTabs from "@/components/hud/FolderTabs";

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
    { key: "users", label: "Employees" },
    { key: "leave", label: "Leave Requests" },
    { key: "attendance", label: "Attendance" },
  ];

  return (
    <div>
      <PageHeader label="HR" title="HR" />

      <FolderTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "users" && (
        <UsersListClient users={users} employees={employees} actorRole={actorRole} actorUid={actorUid} />
      )}
      {tab === "leave" && <LeaveRequestsAdminClient requests={leaveRequests} />}
      {tab === "attendance" && <AttendanceAdminClient records={attendance} />}
    </div>
  );
}
