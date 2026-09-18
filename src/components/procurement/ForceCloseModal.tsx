"use client";

import { useState } from "react";

// v2 Procurement workflow Phase 2 — Closure's explicit override path, for
// write-offs / disputed or abandoned orders that will never fully
// reconcile. Always requires a reason, kept for audit (purchase_orders.close_reason).
export default function ForceCloseModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-lg uppercase tracking-wide">Force close</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-black/60 dark:text-white/60">
          This closes the purchase order even though it hasn&apos;t fully reconciled (GRN + invoice +
          full payment). Use this for write-offs or orders that will never fully reconcile.
        </p>

        <div className="space-y-1">
          <label className="text-sm font-medium">Reason (required)</label>
          <textarea
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm min-h-[70px] focus:outline-none focus:ring-2 focus:ring-accent"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <span className="btn-glow inline-block">
            <button
              type="button"
              onClick={onClose}
              className="btn-skew px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              Cancel
            </button>
          </span>
          <span className="btn-glow-red inline-block">
            <button
              type="button"
              disabled={!reason.trim()}
              onClick={() => onConfirm(reason.trim())}
              className="btn-skew border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Force close
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
