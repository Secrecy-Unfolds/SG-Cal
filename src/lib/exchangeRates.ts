import { query } from "@/lib/db";

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

export async function upsertExchangeRate(currency: string, rateToBase: number): Promise<ExchangeRateRow> {
  const res = await query<ExchangeRateRow>(
    `INSERT INTO exchange_rates (currency, rate_to_base, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (currency) DO UPDATE SET rate_to_base = $2, updated_at = now()
     RETURNING currency, rate_to_base, updated_at`,
    [currency, rateToBase]
  );
  return res.rows[0];
}

export async function deleteExchangeRate(currency: string): Promise<void> {
  await query(`DELETE FROM exchange_rates WHERE currency = $1`, [currency]);
}

// A currency -> rate_to_base lookup map, ready for convertToBase()
// (currencyDisplay.ts) — fetched once per request and reused across every
// blended-total computation on that page, rather than re-querying per item.
export async function getExchangeRateMap(): Promise<Map<string, number>> {
  const rows = await listExchangeRates();
  return new Map(rows.map((r) => [r.currency, parseFloat(r.rate_to_base)]));
}
