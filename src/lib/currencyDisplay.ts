// Client-safe currency-blending helpers — no server-only imports. See
// docs/erp-v2-roadmap.md's "Currency blending" design and its "Currency as
// a fixed list" item's monthly rate-history follow-up. Manual Admin-entered
// exchange rates (no live FX API), blended totals computed live and never
// stored, existing per-currency figures untouched and shown alongside the
// new blended one.

export type BlendedTotal = {
  total: number;
  /** Currencies present in the input that had no configured rate, so were left out of `total`. */
  excludedCurrencies: string[];
};

// v2.1 monthly-frozen exchange rates — see db/schema.sql's
// exchange_rate_history comment and getExchangeRateSnapshot()
// (exchangeRates.ts) for how this gets built. `current` is today's
// Settings-edited rate, as a plain object (not a Map) so it survives a
// server component -> client component prop boundary. `history` is every
// frozen per-month snapshot, across every currency.
export type ExchangeRateSnapshot = {
  current: Record<string, number>;
  history: { currency: string; effectiveMonth: string; rate: number }[];
};

function monthStart(dateISO: string): string {
  return `${dateISO.slice(0, 7)}-01`;
}

// The rate that was actually in effect for `currency` during the calendar
// month containing `dateISO` — the latest history snapshot at or before
// that month (so a month with no explicit edit keeps the last rate that
// was set, rather than going unconfigured), falling back to today's
// `current` rate only when no historical snapshot exists at all yet (a
// rate that's never been through a month-close, e.g. right after it was
// first entered this session, before `upsertExchangeRate` had a chance to
// freeze this month's row — or data older than this feature).
export function resolveHistoricalRate(
  currency: string,
  dateISO: string,
  snapshot: ExchangeRateSnapshot
): number | null {
  const month = monthStart(dateISO);
  let best: { effectiveMonth: string; rate: number } | null = null;
  for (const h of snapshot.history) {
    if (h.currency !== currency || h.effectiveMonth > month) continue;
    if (!best || h.effectiveMonth > best.effectiveMonth) best = h;
  }
  if (best) return best.rate;
  const current = snapshot.current[currency];
  return current !== undefined && Number.isFinite(current) ? current : null;
}

// Converts `amount` (in `currency`) into the base currency using the rate
// in effect for `dateISO`'s own month. Returns null when it can't be
// converted — either an unconfigured currency, which must be excluded
// rather than guessed at a 1:1 rate (same no-silent-default precedent used
// elsewhere in this app), or a non-finite amount.
export function convertToBaseForDate(
  amount: number,
  currency: string,
  dateISO: string,
  baseCurrency: string,
  snapshot: ExchangeRateSnapshot
): number | null {
  if (!Number.isFinite(amount)) return null;
  if (currency === baseCurrency) return amount;
  const rate = resolveHistoricalRate(currency, dateISO, snapshot);
  if (rate === null) return null;
  return amount * rate;
}

// Sums a list of (amount, currency, date) items into one blended total in
// the base currency — each item converts using the rate that was actually
// in effect during *its own* month, so a total spanning several months
// (the Ledger's all-time total, Dashboard tiles, etc.) stays historically
// accurate even after this month's rate changes again. Currencies with no
// configured rate are excluded from the sum (not guessed) and reported
// back so the caller can show a "N transactions in EUR not included — no
// rate set" note.
export function sumBlendedByDate(
  items: { amount: number; currency: string; date: string }[],
  baseCurrency: string,
  snapshot: ExchangeRateSnapshot
): BlendedTotal {
  let total = 0;
  const excluded = new Set<string>();
  for (const { amount, currency, date } of items) {
    const converted = convertToBaseForDate(amount, currency, date, baseCurrency, snapshot);
    if (converted === null) {
      excluded.add(currency);
      continue;
    }
    total += converted;
  }
  return { total, excludedCurrencies: Array.from(excluded) };
}
