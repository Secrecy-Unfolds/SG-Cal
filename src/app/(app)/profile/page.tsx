import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserById } from "@/lib/users";
import ProfileDetailsForm from "@/components/ProfileDetailsForm";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await getUserById(session.uid);
  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Profile</h1>
      <ProfileDetailsForm user={user} />
      <ProfileForm />
    </div>
  );
}
