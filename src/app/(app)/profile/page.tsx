import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserById } from "@/lib/users";
import { listSubordinatesWithDetails } from "@/lib/hr";
import ProfileDetailsForm from "@/components/ProfileDetailsForm";
import ProfileForm from "@/components/ProfileForm";
import MyHRCard from "@/components/MyHRCard";
import MyTeamCard from "@/components/hr/MyTeamCard";
import NotificationPreferencesForm from "@/components/NotificationPreferencesForm";
import PageHeader from "@/components/hud/PageHeader";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.uid);
  if (!user) redirect("/login");

  // "My Team" (0.2.17): shown only if this person has at least one
  // subordinate in the reporting chain — a Department's Manager/Director, a
  // Project Head, or a Team Lead. Most employees have none.
  const subordinates = await listSubordinatesWithDetails(session.uid);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader label="ACCOUNT" title="Profile" />
      <ProfileDetailsForm user={user} />
      <MyHRCard userId={user.id} />
      {subordinates.length > 0 && <MyTeamCard members={subordinates} />}
      <ProfileForm />
      <NotificationPreferencesForm role={session.role} />
    </div>
  );
}
