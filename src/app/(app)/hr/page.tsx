import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel, listUsers } from "@/lib/users";
import {
  getLeaveBalancesForAll,
  listAllAttendance,
  listAllLeaveRequests,
  listEmployeesWithDetails,
  listPublicHolidays,
} from "@/lib/hr";
import { canAccessModule } from "@/lib/orgModules";
import HRTabs from "@/components/hr/HRTabs";

export default async function HRPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const isAdmin = isAdminLevel(session.role);
  // Organization structure Phase 4 (0.2.18): a plain user whose Department
  // maps to "hr" can view this page too, but VIEW-only — and only the
  // Leave Requests / Attendance / Public Holidays tabs. The Employees tab
  // (full HR records, including Phase 5's sensitive fields) stays
  // Admin-level-only deliberately: department-module access is a coarser
  // rule than Phase 5's self/Admin/hierarchical-superior rule, and
  // widening it here would leak Civil ID/Passport/salary/etc. to anyone
  // in the HR department, not just an actual superior — see docs/handover.md.
  if (!isAdmin && !(await canAccessModule(session, "hr"))) redirect("/");

  const [users, employees, leaveRequests, attendance, holidays, balances] = await Promise.all([
    isAdmin ? listUsers() : Promise.resolve([]),
    isAdmin ? listEmployeesWithDetails() : Promise.resolve([]),
    listAllLeaveRequests(),
    listAllAttendance(),
    listPublicHolidays(),
    isAdmin ? getLeaveBalancesForAll() : Promise.resolve({}),
  ]);

  return (
    <HRTabs
      users={users}
      employees={employees}
      leaveRequests={leaveRequests}
      attendance={attendance}
      holidays={holidays}
      balances={balances}
      actorRole={session.role}
      actorUid={session.uid}
      isAdmin={isAdmin}
    />
  );
}
