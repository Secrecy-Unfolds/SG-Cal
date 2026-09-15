"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import CustomerFormModal from "@/components/accounting/CustomerFormModal";
import type { CustomerRow } from "@/lib/customers";
import { HudFrame } from "@/components/hud/HudFrame";

export default function CustomersClient({ customers }: { customers: CustomerRow[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [deleting, setDeleting] = useState<CustomerRow | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleting) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete customer");
        return;
      }
      setDeleting(null);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

      <div className="flex justify-end mb-4">
        <span className="btn-glow inline-block">
          <button onClick={() => setShowCreate(true)} className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium">
            + Add Customer
          </button>
        </span>
      </div>

      {customers.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No customers yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {customers.map((c) => (
            <HudFrame
              key={c.id}
              corners="tl-br"
              className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-black/50 dark:text-white/50 truncate">
                    {[c.email, c.contact].filter(Boolean).join(" · ") || "No further details"}
                  </div>
                  {c.address && <div className="text-xs text-black/40 dark:text-white/40 truncate mt-1">{c.address}</div>}
                </div>
                <div className="shrink-0 flex gap-2">
                  <button onClick={() => setEditing(c)} className="text-xs text-accent hover:underline">
                    Edit
                  </button>
                  <button onClick={() => setDeleting(c)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                    Delete
                  </button>
                </div>
              </div>
            </HudFrame>
          ))}
        </div>
      )}

      {showCreate && (
        <CustomerFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <CustomerFormModal
          customer={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete customer"
          message={`Delete "${deleting.name}"? This also removes their invoices (posted revenue transactions stay).`}
          confirmLabel="Delete"
          loading={working}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
