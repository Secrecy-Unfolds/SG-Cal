import { query } from "@/lib/db";

// v2.1 extensible fixed currency list — see docs/erp-v2-roadmap.md's
// "Currency as a fixed list" item. Backed by the `currencies` table
// (seeded with a starter list + backfilled from every currency value
// already in real data), not hardcoded here, so picking "Other" on any
// form and adding a new code makes it a real option everywhere else too.

export async function listCurrencies(): Promise<string[]> {
  const res = await query<{ code: string }>(`SELECT code FROM currencies ORDER BY code ASC`);
  return res.rows.map((r) => r.code);
}

export async function addCurrency(code: string): Promise<string[]> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) throw new Error("Currency code is required");
  await query(`INSERT INTO currencies (code) VALUES ($1) ON CONFLICT (code) DO NOTHING`, [normalized]);
  return listCurrencies();
}
