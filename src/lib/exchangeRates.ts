import { query } from "@/lib/db";
import type { ExchangeRateSnapshot } from "@/lib/currencyDisplay";

// v2 currency blending — manual, Admin-entered exchange rates (not a live
// FX API). See docs/erp-v2-roadmap.md's "Currency blending" section.

export type ExchangeRateRow = {
  currency: string;
  rate_to_base: string; // numeric comes back as a string from pg
  updated_at: Date;
};

export async function listExchangeRates(): Promise<ExchangeRateRow[]> {
  const res = await query<ExchangeRateRow>(
    `SELECT currency, rate_to_base, updated_at FROM exchange_rates ORDER BY currency ASC`
  );
  return res.rows;
}

// Upserts the "current" editable rate (shown/edited on Settings) *and*
// freezes a snapshot of it for the current calendar month in
// exchange_rate_history — a second edit later in the same month overwrites
// that same month's snapshot rather than creating a new one, but a past
// month's snapshot is never touched, so already-reported figures for that
// month don't shift. See lib/currencyDisplay.ts's resolveHistoricalRate()
// for how a given date's rate gets picked back out of this history.
export async function upsertExchangeRate(currency: string, rateToBase: number): Promise<ExchangeRateRow> {
  const res = await query<ExchangeRateRow>(
    `INSERT INTO exchange_rates (currency, rate_to_base, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (currency) DO UPDATE SET rate_to_base = $2, updated_at = now()
     RETURNING currency, rate_to_base, updated_at`,
    [currency, rateToBase]
  );
  await query(
    `INSERT INTO exchange_rate_history (currency, effective_month, rate_to_base)
     VALUES ($1, date_trunc('month', now())::date, $2)
     ON CONFLICT (currency, effective_month) DO UPDATE SET rate_to_base = $2, recorded_at = now()`,
    [currency, rateToBase]
  );
  return res.rows[0];
}

// Deletes the "current" row only — past months' frozen history snapshots
// stay exactly as they were (removing today's rate shouldn't rewrite what
// already-reported months used at the time).
export async function deleteExchangeRate(currency: string): Promise<void> {
  await query(`DELETE FROM exchange_rates WHERE currency = $1`, [currency]);
}

// A currency -> rate_to_base lookup map of *today's* rate — the `current`
// half of getExchangeRateSnapshot() below.
export async function getExchangeRateMap(): Promise<Map<string, number>> {
  const rows = await listExchangeRates();
  return new Map(rows.map((r) => [r.currency, parseFloat(r.rate_to_base)]));
}

// Everything convertToBaseForDate()/sumBlendedByDate() (currencyDisplay.ts)
// need to resolve any dated item's own historical rate — fetched once per
// page/request and reused across every blended-total computation on it,
// rather than re-querying per item or per month.
export async function getExchangeRateSnapshot(): Promise<ExchangeRateSnapshot> {
  const [current, historyRes] = await Promise.all([
    getExchangeRateMap(),
    query<{ currency: string; effective_month: string; rate_to_base: string }>(
      `SELECT currency, effective_month, rate_to_base FROM exchange_rate_history ORDER BY currency ASC, effective_month ASC`
    ),
  ]);
  return {
    current: Object.fromEntries(current),
    history: historyRes.rows.map((r) => ({
      currency: r.currency,
      effectiveMonth: r.effective_month,
      rate: parseFloat(r.rate_to_base),
    })),
  };
}
