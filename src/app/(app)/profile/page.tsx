import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserById } from "@/lib/users";
import ProfileDetailsForm from "@/components/ProfileDetailsForm";
import ProfileForm from "@/components/ProfileForm";
import MyHRCard from "@/components/MyHRCard";
import PageHeader from "@/components/hud/PageHeader";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.uid);
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader label="ACCOUNT" title="Profile" />
      <ProfileDetailsForm user={user} />
      <MyHRCard userId={user.id} />
      <ProfileForm />
    </div>
  );
}
