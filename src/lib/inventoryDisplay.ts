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
