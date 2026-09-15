// Client-safe currency-blending helpers — no server-only imports. See
// docs/erp-v2-roadmap.md's "Currency blending" section for the design:
// manual Admin-entered exchange rates (no live FX API), blended totals
// computed live and never stored, existing per-currency figures untouched
// and shown alongside the new blended one.

// Converts `amount` (in `currency`) into the base currency using `rates`
// (a currency -> rate_to_base map, from getExchangeRateMap() in
// exchangeRates.ts). Returns null when it can't be converted — either an
// unconfigured currency, which must be excluded rather than guessed at a
// 1:1 rate (same no-silent-default precedent used elsewhere in this app),
// or a non-finite amount.
export function convertToBase(
  amount: number,
  currency: string,
  baseCurrency: string,
  rates: Map<string, number>
): number | null {
  if (!Number.isFinite(amount)) return null;
  if (currency === baseCurrency) return amount;
  const rate = rates.get(currency);
  if (rate === undefined || !Number.isFinite(rate)) return null;
  return amount * rate;
}

export type BlendedTotal = {
  total: number;
  /** Currencies present in the input that had no configured rate, so were left out of `total`. */
  excludedCurrencies: string[];
};

// Sums a list of (amount, currency) pairs into one blended total in the
// base currency. Currencies with no configured rate are excluded from the
// sum (not guessed) and reported back so the caller can show a "N
// transactions in EUR not included — no rate set" note.
export function sumBlended(
  amounts: { amount: number; currency: string }[],
  baseCurrency: string,
  rates: Map<string, number>
): BlendedTotal {
  let total = 0;
  const excluded = new Set<string>();
  for (const { amount, currency } of amounts) {
    const converted = convertToBase(amount, currency, baseCurrency, rates);
    if (converted === null) {
      excluded.add(currency);
      continue;
    }
    total += converted;
  }
  return { total, excludedCurrencies: Array.from(excluded) };
}
