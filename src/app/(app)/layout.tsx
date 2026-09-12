import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isAdminLevel } from "@/lib/users";
import { listAllAttendance } from "@/lib/hr";
import { toMuscatDateInput } from "@/lib/time";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Radar-background "contacts" — org-wide attendance count, same
  // admin-level gate Dashboard already uses for this exact figure (plain
  // users still get the radar scope, just without the blip count).
  let presentCount = 0;
  if (isAdminLevel(session.role)) {
    const todayKey = toMuscatDateInput(new Date());
    const attendance = await listAllAttendance();
    presentCount = new Set(
      attendance.filter((a) => a.work_date === todayKey).map((a) => a.user_id)
    ).size;
  }

  return (
    <AppShell session={session} presentCount={presentCount}>
      {children}
    </AppShell>
  );
}
