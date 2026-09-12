import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel, listUsers } from "@/lib/users";
import { listAllAttendance, listAllLeaveRequests, listEmployeesWithDetails } from "@/lib/hr";
import HRTabs from "@/components/hr/HRTabs";

export default async function HRPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminLevel(session.role)) redirect("/");

  const [users, employees, leaveRequests, attendance] = await Promise.all([
    listUsers(),
    listEmployeesWithDetails(),
    listAllLeaveRequests(),
    listAllAttendance(),
  ]);

  return (
    <HRTabs
      users={users}
      employees={employees}
      leaveRequests={leaveRequests}
      attendance={attendance}
      actorRole={session.role}
      actorUid={session.uid}
    />
  );
}
