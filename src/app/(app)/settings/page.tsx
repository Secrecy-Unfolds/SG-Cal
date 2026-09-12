import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDigestSettings } from "@/lib/settings";
import SettingsForm from "@/components/SettingsForm";
import PageHeader from "@/components/hud/PageHeader";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "super_admin") redirect("/");

  const settings = await getDigestSettings();

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader label="CONFIGURATION" title="Settings" />
      <SettingsForm initialSettings={settings} />
    </div>
  );
}
