import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getBaseCurrency, getDigestSettings } from "@/lib/settings";
import { listExchangeRates } from "@/lib/exchangeRates";
import SettingsForm from "@/components/SettingsForm";
import ExchangeRatesManager from "@/components/ExchangeRatesManager";
import PageHeader from "@/components/hud/PageHeader";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "super_admin") redirect("/");

  const [digestSettings, baseCurrency, exchangeRates] = await Promise.all([
    getDigestSettings(),
    getBaseCurrency(),
    listExchangeRates(),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader label="CONFIGURATION" title="Settings" />
      <SettingsForm initialSettings={{ ...digestSettings, baseCurrency }} />
      <ExchangeRatesManager baseCurrency={baseCurrency} initialRates={exchangeRates} />
    </div>
  );
}
