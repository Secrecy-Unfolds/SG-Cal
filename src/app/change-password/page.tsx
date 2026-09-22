import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ForcedPasswordChangeForm from "@/components/ForcedPasswordChangeForm";

// Lives outside the (app) layout on purpose (like /login): a session locked
// to "must change password" can't reach anything else, and the app shell
// would just bounce it back here.
//
// Deliberately never redirects an authenticated session away, even if it no
// longer needs the change (a stale token flag could then loop with the
// middleware) — submitting the form re-signs the session and clears it.
export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <ForcedPasswordChangeForm username={session.username} required={!!session.mcp} />;
}
