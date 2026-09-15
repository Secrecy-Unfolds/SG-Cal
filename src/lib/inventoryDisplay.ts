// Client-safe Inventory constants/types — no server-only imports.

export type AssetType = "fixed" | "depreciating" | "consumable";

export const ASSET_TYPES: AssetType[] = ["fixed", "depreciating", "consumable"];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  fixed: "Fixed asset",
  depreciating: "Depreciating asset",
  consumable: "Consumable",
};

export const ASSET_TYPE_BADGE_CLASS: Record<AssetType, string> = {
  fixed: "bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300",
  depreciating: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
  consumable: "bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50",
};

export function isAssetType(value: unknown): value is AssetType {
  return ASSET_TYPES.includes(value as AssetType);
}

// Straight-line depreciation, computed live — never persisted (same
// "compute on read" pattern as procurementDisplay.ts's computeCapitalNeeded).
// Only meaningful for asset_type = "depreciating"; callers decide when to
// use this vs. a manually-edited current_value for fixed/consumable items.
// Returns null when there isn't enough data to compute (no purchase cost/
// date/useful life set yet) — callers should fall back to the stored
// current_value in that case, not assume 0.
export function computeDepreciatedValue(
  purchaseCost: number,
  purchaseDateISO: string,
  usefulLifeMonths: number
): number | null {
  if (!Number.isFinite(purchaseCost) || usefulLifeMonths <= 0) return null;
  const purchaseDate = new Date(purchaseDateISO);
  if (Number.isNaN(purchaseDate.getTime())) return null;

  const now = new Date();
  const monthsElapsed =
    (now.getFullYear() - purchaseDate.getFullYear()) * 12 +
    (now.getMonth() - purchaseDate.getMonth()) +
    (now.getDate() >= purchaseDate.getDate() ? 0 : -1);
  const clampedMonths = Math.min(Math.max(monthsElapsed, 0), usefulLifeMonths);

  const depreciationPerMonth = purchaseCost / usefulLifeMonths;
  const value = purchaseCost - depreciationPerMonth * clampedMonths;
  return Math.max(0, Math.round(value * 100) / 100);
}
