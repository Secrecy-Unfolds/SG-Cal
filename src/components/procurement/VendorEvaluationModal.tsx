"use client";

import { useMemo, useState } from "react";
import type { ProductVendorData } from "@/components/procurement/VendorFormModal";

// v2 Procurement workflow Phase 1: evaluation scoring — a weighted
// multi-criteria comparison across a product's linked vendors, replacing
// the star rating alone as the deciding factor. Price/delivery/warranty
// have no algorithmic way to score free text, so each carries its own 1-5
// star rating (VendorFormModal.tsx) alongside quality_rating; this view
// combines all four into one adjustable-weight score.
type Criterion = "price" | "quality" | "delivery" | "warranty";
type Weights = Record<Criterion, number>;

const CRITERIA: { key: Criterion; label: string; field: "price_rating" | "quality_rating" | "delivery_rating" | "warranty_rating" }[] = [
  { key: "price", label: "Price", field: "price_rating" },
  { key: "quality", label: "Quality", field: "quality_rating" },
  { key: "delivery", label: "Delivery", field: "delivery_rating" },
  { key: "warranty", label: "Warranty", field: "warranty_rating" },
];

// A vendor missing a rating for some criterion isn't penalized for it —
// that criterion is simply left out of their own weighted average, same
// "excluded, not guessed" precedent currency blending uses for an
// unconfigured currency.
function weightedScore(v: ProductVendorData, weights: Weights): number | null {
  let sum = 0;
  let totalWeight = 0;
  for (const c of CRITERIA) {
    const rating = v[c.field];
    const weight = weights[c.key];
    if (rating === null || weight <= 0) continue;
    sum += rating * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? sum / totalWeight : null;
}

function RatingCell({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-black/30 dark:text-white/30">—</span>;
  return (
    <span className="text-amber-500 whitespace-nowrap">
      {"★".repeat(rating)}
      <span className="text-black/20 dark:text-white/20">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function VendorEvaluationModal({
  vendors,
  preferredVendorId,
  onClose,
  onMarkPreferred,
}: {
  vendors: ProductVendorData[];
  preferredVendorId: number | null;
  onClose: () => void;
  onMarkPreferred: (vendor: ProductVendorData) => void;
}) {
  const [weights, setWeights] = useState<Weights>({ price: 25, quality: 25, delivery: 25, warranty: 25 });

  const ranked = useMemo(
    () =>
      vendors
        .map((vendor) => ({ vendor, score: weightedScore(vendor, weights) }))
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    [vendors, weights]
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div className="w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">Compare vendors</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-black/40 dark:text-white/40">
          Adjust how much each criterion matters — the ranking updates live. A vendor with no
          rating for a criterion just has that criterion left out of its own score, not counted
          against it.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CRITERIA.map((c) => (
            <div key={c.key} className="space-y-1">
              <label className="text-xs font-medium flex justify-between">
                <span>{c.label}</span>
                <span className="text-black/40 dark:text-white/40">{weights[c.key]}</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={weights[c.key]}
                onChange={(e) => setWeights((prev) => ({ ...prev, [c.key]: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
          ))}
        </div>

        {vendors.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">No vendors to compare yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">
                  <th className="py-2 pr-3">Vendor</th>
                  {CRITERIA.map((c) => (
                    <th key={c.key} className="py-2 pr-3">
                      {c.label}
                    </th>
                  ))}
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ vendor: v, score }) => (
                  <tr key={v.id} className="border-t border-black/5 dark:border-white/10">
                    <td className="py-2 pr-3 font-medium whitespace-nowrap">
                      {v.name}
                      {v.vendor_id === preferredVendorId && (
                        <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300">
                          Preferred
                        </span>
                      )}
                    </td>
                    {CRITERIA.map((c) => (
                      <td key={c.key} className="py-2 pr-3">
                        <RatingCell rating={v[c.field]} />
                      </td>
                    ))}
                    <td className="py-2 pr-3 font-semibold">{score !== null ? score.toFixed(1) : "—"}</td>
                    <td className="py-2">
                      {v.vendor_id !== preferredVendorId && (
                        <button
                          type="button"
                          onClick={() => onMarkPreferred(v)}
                          className="text-xs text-accent hover:underline whitespace-nowrap"
                        >
                          Mark preferred
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <span className="btn-glow inline-block">
            <button
              type="button"
              onClick={onClose}
              className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              Close
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
