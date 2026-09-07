import { getSession } from "@/lib/auth";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfilePage() {
  const session = await getSession();

  return (
    <main className="min-h-screen max-w-md mx-auto px-4 py-6">
      <a href="/" className="text-sm text-black/50 dark:text-white/50 hover:underline">
        ← Back to calendar
      </a>
      <h1 className="text-xl font-semibold mt-3 mb-1">Change Password</h1>
      <p className="text-sm text-black/50 dark:text-white/50 mb-6">
        Signed in as {session?.username ?? ""}
      </p>
      <ProfileForm />
    </main>
  );
}
