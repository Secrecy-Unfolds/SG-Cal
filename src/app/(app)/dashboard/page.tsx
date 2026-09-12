import { redirect } from "next/navigation";

// The Dashboard is now the landing page at "/" — this route stays as a
// redirect so old links/bookmarks still land somewhere.
export default function DashboardPage() {
  redirect("/");
}
