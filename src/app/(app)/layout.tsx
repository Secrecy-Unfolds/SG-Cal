import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserById, isAdminLevel } from "@/lib/users";
import { listAllAttendance } from "@/lib/hr";
import { toMuscatDateInput } from "@/lib/time";
import AppShell from "@/components/AppShell";
import packageJson from "../../../package.json";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Fetched fresh per request (not stored in the session token itself) so
  // a just-uploaded avatar shows up without needing to re-login — unlike
  // username/role, which the session token snapshots at login time.
  const user = await getUserById(session.uid);

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
    <AppShell
      session={session}
      pictureUrl={user?.picture_url ?? null}
      presentCount={presentCount}
      appVersion={packageJson.version}
    >
      {children}
    </AppShell>
  );
}
