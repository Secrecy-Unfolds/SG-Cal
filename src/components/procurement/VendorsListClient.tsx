"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import EditVendorModal from "@/components/procurement/EditVendorModal";
import type { VendorWithProductsRow } from "@/lib/procurement";
import { HudFrame } from "@/components/hud/HudFrame";

export default function VendorsListClient({ vendors }: { vendors: VendorWithProductsRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<VendorWithProductsRow | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<VendorWithProductsRow | null>(null);

  async function handleDelete(vendor: VendorWithProductsRow) {
    setConfirmingDelete(null);
    setError(null);
    setDeletingId(vendor.id);
    try {
      const res = await fetch(`/api/procurement/vendors/${vendor.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete vendor");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  if (vendors.length === 0) {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        No vendors yet — add one from a product&rsquo;s page.
      </p>
    );
  }

  return (
    <div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}
      <div className="space-y-3">
        {vendors.map((v) => (
          <HudFrame
            key={v.id}
            corners="tl-br"
            className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div>
                <div className="text-sm font-semibold">{v.name}</div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {[v.country, v.niche].filter(Boolean).join(" · ") || "No further details"}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(v)}
                  className="text-xs btn-skew btn-glow border border-black/10 dark:border-white/10 px-3 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/5"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(v)}
                  disabled={deletingId === v.id}
                  className="text-xs btn-skew btn-glow border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-3 py-1.5 disabled:opacity-50"
                >
                  {deletingId === v.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>

            <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide mb-1">
              Supplies {v.products.length} product{v.products.length === 1 ? "" : "s"}
            </div>
            {v.products.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {v.products.map((p) => (
                  <Link
                    key={p.id}
                    href={`/procurement/${p.id}`}
                    className="text-xs rounded-full px-2.5 py-1 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            )}
          </HudFrame>
        ))}
      </div>

      {editing && (
        <EditVendorModal
          vendor={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {confirmingDelete && (
        <ConfirmModal
          title="Delete vendor"
          message={`Delete "${confirmingDelete.name}"? ${
            confirmingDelete.products.length === 0
              ? "It isn't linked to any products."
              : `It will be removed from ${confirmingDelete.products.length} product${
                  confirmingDelete.products.length === 1 ? "" : "s"
                }.`
          }`}
          confirmLabel="Delete"
          loading={deletingId === confirmingDelete.id}
          onConfirm={() => handleDelete(confirmingDelete)}
          onCancel={() => setConfirmingDelete(null)}
        />
      )}
    </div>
  );
}
