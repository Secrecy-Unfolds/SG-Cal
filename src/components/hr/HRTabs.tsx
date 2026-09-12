"use client";

import { useState } from "react";
import EmployeesListClient from "@/components/hr/EmployeesListClient";
import LeaveRequestsAdminClient from "@/components/hr/LeaveRequestsAdminClient";
import AttendanceAdminClient from "@/components/hr/AttendanceAdminClient";
import type { EmployeeDetails, LeaveRequestRow, AttendanceRecordRow } from "@/lib/hr";

type Tab = "employees" | "leave" | "attendance";

export default function HRTabs({
  employees,
  leaveRequests,
  attendance,
}: {
  employees: EmployeeDetails[];
  leaveRequests: LeaveRequestRow[];
  attendance: AttendanceRecordRow[];
}) {
  const [tab, setTab] = useState<Tab>("employees");

  const tabs: { key: Tab; label: string }[] = [
    { key: "employees", label: "Employees" },
    { key: "leave", label: "Leave Requests" },
    { key: "attendance", label: "Attendance" },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">HR</h1>

      <div className="flex rounded-lg border border-black/10 dark:border-white/10 p-1 text-sm w-fit mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md font-medium transition-colors ${
              tab === t.key ? "bg-accent text-white" : "text-black/50 dark:text-white/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "employees" && <EmployeesListClient employees={employees} />}
      {tab === "leave" && <LeaveRequestsAdminClient requests={leaveRequests} />}
      {tab === "attendance" && <AttendanceAdminClient records={attendance} />}
    </div>
  );
}
