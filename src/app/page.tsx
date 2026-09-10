import { getSession } from "@/lib/auth";
import CalendarView from "@/components/CalendarView";

export default async function HomePage() {
  const session = await getSession();

  return (
    <CalendarView
      currentUser={session ? { uid: session.uid, username: session.username, role: session.role } : null}
    />
  );
}
