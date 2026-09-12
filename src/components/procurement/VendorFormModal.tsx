"use client";

import { useEffect, useRef, useState } from "react";
import { HudFrame } from "@/components/hud/HudFrame";

// One vendor's offering on one product (procurement_product_vendors joined
// with its vendor's identity) — vendors are global and can be linked to
// several products, so `id` here is the link, not the vendor itself.
export type ProductVendorData = {
  id: number;
  vendor_id: number;
  name: string;
  country: string;
  niche: string;
  pricing: string;
  payment_terms: string;
  quality_rating: number | null;
  delivery_period: string;
  warranty: string;
};

type VendorSearchResult = { id: number; name: string; country: string; niche: string };

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent";

export default function VendorFormModal({
  productId,
  existingVendorIds,
  vendorLink,
  onClose,
  onSaved,
}: {
  productId: number;
  existingVendorIds: number[];
  vendorLink?: ProductVendorData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!vendorLink;

  // Add flow: "search" (pick or create a vendor) -> "offering" (per-product details).
  // Edit flow skips straight to "offering" for the existing link.
  const [stage, setStage] = useState<"search" | "offering">(isEdit ? "offering" : "search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VendorSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorSearchResult | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const [newName, setNewName] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [newNiche, setNewNiche] = useState("");

  const [pricing, setPricing] = useState(vendorLink?.pricing ?? "");
  const [paymentTerms, setPaymentTerms] = useState(vendorLink?.payment_terms ?? "");
  const [qualityRating, setQualityRating] = useState<number | null>(vendorLink?.quality_rating ?? null);
  const [deliveryPeriod, setDeliveryPeriod] = useState(vendorLink?.delivery_period ?? "");
  const [warranty, setWarranty] = useState(vendorLink?.warranty ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isEdit) return;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/procurement/vendors?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json().catch(() => ({}));
        const vendors: VendorSearchResult[] = res.ok ? data.vendors ?? [] : [];
        setResults(vendors.filter((v) => !existingVendorIds.includes(v.id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isEdit]);

  function pickExisting(v: VendorSearchResult) {
    setSelectedVendor(v);
    setCreatingNew(false);
    setStage("offering");
  }

  function pickCreateNew() {
    setSelectedVendor(null);
    setCreatingNew(true);
    setNewName(query.trim());
    setStage("offering");
  }

  function backToSearch() {
    setSelectedVendor(null);
    setCreatingNew(false);
    setStage("search");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (creatingNew && !newName.trim()) {
      setError("Vendor name is required");
      return;
    }
    const offering = { pricing, paymentTerms, qualityRating, deliveryPeriod, warranty };
    setSaving(true);
    try {
      const res = isEdit
        ? await fetch(`/api/procurement/product-vendors/${vendorLink!.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(offering),
          })
        : await fetch(`/api/procurement/products/${productId}/vendors`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              selectedVendor
                ? { vendorId: selectedVendor.id, ...offering }
                : { name: newName.trim(), country: newCountry, niche: newNiche, ...offering }
            ),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save vendor");
        return;
      }
      onSaved();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <HudFrame
        corners="all"
        className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">
            {isEdit ? "Edit vendor" : stage === "search" ? "Add vendor" : "Vendor details"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        {stage === "search" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Vendor name</label>
              <input
                className={inputClass}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search existing vendors or type a new one"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              {searching && <p className="text-xs text-black/40 dark:text-white/40">Searching…</p>}
              {results.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => pickExisting(v)}
                  className="w-full text-left rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm hover:bg-black/[0.03] dark:hover:bg-white/5"
                >
                  <div className="font-medium">{v.name}</div>
                  <div className="text-xs text-black/50 dark:text-white/50">
                    {[v.country, v.niche].filter(Boolean).join(" · ") || "No further details"}
                  </div>
                </button>
              ))}
              {query.trim() && (
                <button
                  type="button"
                  onClick={pickCreateNew}
                  className="w-full text-left rounded-lg border border-dashed border-accent/50 text-accent px-3 py-2 text-sm hover:bg-accent/5"
                >
                  + Create new vendor &ldquo;{query.trim()}&rdquo;
                </button>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {stage === "offering" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isEdit || selectedVendor ? (
              <div className="rounded-lg bg-black/[0.02] dark:bg-white/5 px-3 py-2">
                <div className="text-sm font-medium">{isEdit ? vendorLink!.name : selectedVendor!.name}</div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {[isEdit ? vendorLink!.country : selectedVendor!.country, isEdit ? vendorLink!.niche : selectedVendor!.niche]
                    .filter(Boolean)
                    .join(" · ") || "No further details"}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Vendor name</label>
                    <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Country</label>
                    <input className={inputClass} value={newCountry} onChange={(e) => setNewCountry(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Niche / products / services</label>
                  <input className={inputClass} value={newNiche} onChange={(e) => setNewNiche(e.target.value)} />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Pricing</label>
                <input
                  className={inputClass}
                  value={pricing}
                  onChange={(e) => setPricing(e.target.value)}
                  placeholder="e.g. 5,200 OMR total incl. shipping"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Payment terms</label>
                <input
                  className={inputClass}
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. 50% deposit, 50% on delivery"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Delivery period</label>
                <input
                  className={inputClass}
                  value={deliveryPeriod}
                  onChange={(e) => setDeliveryPeriod(e.target.value)}
                  placeholder="e.g. 2-3 weeks"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Warranty</label>
                <input
                  className={inputClass}
                  value={warranty}
                  onChange={(e) => setWarranty(e.target.value)}
                  placeholder="e.g. 1 year"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Quality rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQualityRating(qualityRating === n ? null : n)}
                    className={`text-2xl leading-none ${
                      qualityRating !== null && n <= qualityRating ? "text-amber-500" : "text-black/20 dark:text-white/20"
                    }`}
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex justify-between items-center pt-2">
              {!isEdit ? (
                <button type="button" onClick={backToSearch} className="text-sm text-black/50 dark:text-white/50 hover:underline">
                  ← Back
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-accent text-ink [clip-path:polygon(6%_0,100%_0,94%_100%,0_100%)] px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </form>
        )}
      </HudFrame>
    </div>
  );
}
