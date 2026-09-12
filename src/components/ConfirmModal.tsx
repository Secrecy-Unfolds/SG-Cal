"use client";

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-[60]">
      <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-lg p-6 space-y-4">
        <h2 className="text-lg font-heading font-semibold uppercase tracking-wide">{title}</h2>
        <p className="text-sm text-black/60 dark:text-white/60">{message}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-skew btn-glow px-4 py-2 text-sm border border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`btn-skew btn-glow px-4 py-2 text-sm font-medium disabled:opacity-50 ${
              danger ? "bg-red-600 text-white" : "bg-accent text-ink"
            }`}
          >
            {loading ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
