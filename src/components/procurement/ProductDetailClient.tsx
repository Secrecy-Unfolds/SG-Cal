"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import ProductFormModal, { ProductData } from "@/components/procurement/ProductFormModal";
import VendorFormModal, { ProductVendorData } from "@/components/procurement/VendorFormModal";
import {
  computeCapitalNeeded,
  formatDateOnly,
  formatMoney,
  PROCUREMENT_STATUS_BADGE_CLASS,
  PROCUREMENT_STATUS_LABELS,
} from "@/lib/procurementDisplay";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs text-black/40 dark:text-white/40">Not rated</span>;
  return (
    <span className="text-amber-500 text-sm">
      {"★".repeat(rating)}
      <span className="text-black/20 dark:text-white/20">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function ProductDetailClient({
  product,
  vendors,
}: {
  product: ProductData & { preferred_vendor_id: number | null };
  vendors: ProductVendorData[];
}) {
  const router = useRouter();
  const [editingProduct, setEditingProduct] = useState(false);
  const [vendorModal, setVendorModal] = useState<
    { mode: "closed" } | { mode: "add" } | { mode: "edit"; vendor: ProductVendorData }
  >({
    mode: "closed",
  });
  const [deleting, setDeleting] = useState(false);
  const [busyVendorId, setBusyVendorId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteProduct, setConfirmingDeleteProduct] = useState(false);
  const [confirmingRemoveVendor, setConfirmingRemoveVendor] = useState<ProductVendorData | null>(null);
  const [sendingToProcurement, setSendingToProcurement] = useState(false);
  const [poCreatedMessage, setPoCreatedMessage] = useState<string | null>(null);

  async function handleDeleteProduct() {
    setConfirmingDeleteProduct(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/procurement/products/${product.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete product");
        return;
      }
      router.push("/procurement");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteVendor(vendor: ProductVendorData) {
    setConfirmingRemoveVendor(null);
    setBusyVendorId(vendor.id);
    try {
      const res = await fetch(`/api/procurement/product-vendors/${vendor.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to remove vendor");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setBusyVendorId(null);
    }
  }

  async function handleSetPreferred(joinId: number, vendorId: number | null) {
    setBusyVendorId(joinId);
    try {
      const res = await fetch(`/api/procurement/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: product.name,
          pictureUrl: product.picture_url,
          description: product.description,
          requiredFor: product.required_for,
          requiredBy: product.required_by,
          quantityNeeded: product.quantity_needed,
          quantityUnit: product.quantity_unit,
          customsNotes: product.customs_notes,
          unitPrice: product.unit_price === null ? null : Number(product.unit_price),
          shippingCost: product.shipping_cost === null ? null : Number(product.shipping_cost),
          customsCost: product.customs_cost === null ? null : Number(product.customs_cost),
          currency: product.currency,
          purchaseDateExpected: product.purchase_date_expected,
          expectedArrival: product.expected_arrival,
          status: product.status,
          preferenceRemarks: product.preference_remarks,
          preferredVendorId: vendorId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to update preferred vendor");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setBusyVendorId(null);
    }
  }

  async function handleSendToProcurement() {
    setSendingToProcurement(true);
    setError(null);
    setPoCreatedMessage(null);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to send to Procurement");
        return;
      }
      setPoCreatedMessage(`Sent to Procurement — Purchase Order #${data.order.id} created.`);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setSendingToProcurement(false);
    }
  }

  return (
    <div>
      <a href="/procurement" className="text-sm text-black/50 dark:text-white/50 hover:underline">
        ← Back to Procurement Planning
      </a>

      <div className="flex flex-col sm:flex-row gap-4 mt-3 mb-6">
        <div className="w-full sm:w-40 aspect-[4/3] sm:aspect-square bg-black/5 dark:bg-white/5 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
          {product.picture_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.picture_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl text-black/20 dark:text-white/20">📦</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span
            className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 mb-1 ${PROCUREMENT_STATUS_BADGE_CLASS[product.status]}`}
          >
            {PROCUREMENT_STATUS_LABELS[product.status]}
          </span>
          <h1 className="text-xl font-semibold break-words">{product.name}</h1>
          {product.description && (
            <p className="text-sm text-black/70 dark:text-white/70 mt-1 whitespace-pre-wrap">{product.description}</p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setEditingProduct(true)}
              className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium"
            >
              Edit
            </button>
            <button
              onClick={() => setConfirmingDeleteProduct(true)}
              disabled={deleting}
              className="rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
            <button
              onClick={handleSendToProcurement}
              disabled={sendingToProcurement || !product.preferred_vendor_id}
              title={!product.preferred_vendor_id ? "Mark a vendor preferred first" : undefined}
              className="rounded-lg border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-40"
            >
              {sendingToProcurement ? "Sending..." : "Send to Procurement"}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}
      {poCreatedMessage && <p className="text-sm text-green-600 dark:text-green-400 mb-4">{poCreatedMessage}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-4 mb-6">
        <Field label="Required for" value={product.required_for} />
        <Field label="Required by" value={formatDateOnly(product.required_by)} />
        <Field label="Quantity" value={`${product.quantity_needed} ${product.quantity_unit}`} />
        <Field label="Unit price" value={formatMoney(product.unit_price, product.currency)} />
        <Field label="Shipping cost" value={formatMoney(product.shipping_cost, product.currency)} />
        <Field label="Customs cost" value={formatMoney(product.customs_cost, product.currency)} />
        <Field
          label="Capital needed (calculated)"
          value={formatMoney(
            computeCapitalNeeded({
              unitPrice: product.unit_price,
              quantityNeeded: product.quantity_needed,
              shippingCost: product.shipping_cost,
              customsCost: product.customs_cost,
            }),
            product.currency
          )}
        />
        <Field label="Customs notes" value={product.customs_notes} />
        <Field label="Purchase date (expected)" value={formatDateOnly(product.purchase_date_expected)} />
        <Field label="Expected arrival" value={formatDateOnly(product.expected_arrival)} />
      </div>

      {product.preference_remarks && (
        <div className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-4 mb-6">
          <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide mb-1">
            Preference remarks
          </div>
          <p className="text-sm whitespace-pre-wrap">{product.preference_remarks}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Possible vendors</h2>
        <button
          onClick={() => setVendorModal({ mode: "add" })}
          className="rounded-lg bg-amber-600 text-white px-4 py-2 text-sm font-medium"
        >
          + Add Vendor
        </button>
      </div>

      {vendors.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No vendors added yet.</p>
      ) : (
        <div className="space-y-3">
          {vendors.map((v) => {
            const isPreferred = product.preferred_vendor_id === v.vendor_id;
            const busy = busyVendorId === v.id;
            return (
              <div
                key={v.id}
                className={`bg-white dark:bg-neutral-900 border rounded-2xl p-4 ${
                  isPreferred ? "border-accent" : "border-black/5 dark:border-white/10"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{v.name}</span>
                      {isPreferred && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300">
                          Preferred
                        </span>
                      )}
                    </div>
                    <Stars rating={v.quality_rating} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSetPreferred(v.id, isPreferred ? null : v.vendor_id)}
                      disabled={busy}
                      className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-50"
                    >
                      {isPreferred ? "Unmark preferred" : "Mark preferred"}
                    </button>
                    <button
                      onClick={() => setVendorModal({ mode: "edit", vendor: v })}
                      className="text-xs rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/5"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmingRemoveVendor(v)}
                      disabled={busy}
                      className="text-xs rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-3 py-1.5 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Country" value={v.country} />
                  <Field label="Niche" value={v.niche} />
                  <Field label="Pricing" value={v.pricing} />
                  <Field label="Payment terms" value={v.payment_terms} />
                  <Field label="Delivery period" value={v.delivery_period} />
                  <Field label="Warranty" value={v.warranty} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingProduct && (
        <ProductFormModal
          product={product}
          onClose={() => setEditingProduct(false)}
          onSaved={() => {
            setEditingProduct(false);
            router.refresh();
          }}
        />
      )}
      {vendorModal.mode === "add" && (
        <VendorFormModal
          productId={product.id}
          existingVendorIds={vendors.map((v) => v.vendor_id)}
          onClose={() => setVendorModal({ mode: "closed" })}
          onSaved={() => {
            setVendorModal({ mode: "closed" });
            router.refresh();
          }}
        />
      )}
      {vendorModal.mode === "edit" && (
        <VendorFormModal
          productId={product.id}
          existingVendorIds={vendors.map((v) => v.vendor_id)}
          vendorLink={vendorModal.vendor}
          onClose={() => setVendorModal({ mode: "closed" })}
          onSaved={() => {
            setVendorModal({ mode: "closed" });
            router.refresh();
          }}
        />
      )}

      {confirmingDeleteProduct && (
        <ConfirmModal
          title="Delete product"
          message={`Delete "${product.name}"? This also removes its vendor comparisons.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDeleteProduct}
          onCancel={() => setConfirmingDeleteProduct(false)}
        />
      )}
      {confirmingRemoveVendor && (
        <ConfirmModal
          title="Remove vendor"
          message={`Remove "${confirmingRemoveVendor.name}" from this product? The vendor itself isn't deleted, just its link to this product.`}
          confirmLabel="Remove"
          loading={busyVendorId === confirmingRemoveVendor.id}
          onConfirm={() => handleDeleteVendor(confirmingRemoveVendor)}
          onCancel={() => setConfirmingRemoveVendor(null)}
        />
      )}
    </div>
  );
}
