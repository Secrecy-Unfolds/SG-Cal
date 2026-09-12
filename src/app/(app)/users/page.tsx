import { redirect } from "next/navigation";

// "Manage Users" was merged into the HR page's "Users" tab — this route
// stays as a redirect so old links/bookmarks still land somewhere.
export default function UsersPage() {
  redirect("/hr");
}
