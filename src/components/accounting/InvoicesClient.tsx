"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import InvoiceFormModal from "@/components/accounting/InvoiceFormModal";
import type { CustomerRow } from "@/lib/customers";
import type { InvoiceLineItemRow, IssuedInvoiceRow } from "@/lib/invoices";
import { INVOICE_STATUS_BADGE_CLASS, INVOICE_STATUS_LABELS, isInvoiceOverdue } from "@/lib/invoicesDisplay";
import { formatMoney } from "@/lib/procurementDisplay";
import { toMuscatDateInput } from "@/lib/time";
import { HudFrame } from "@/components/hud/HudFrame";
import { PaginationControls, usePagination } from "@/components/Pagination";

export default function InvoicesClient({ invoices, customers }: { invoices: IssuedInvoiceRow[]; customers: CustomerRow[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<{ invoice: IssuedInvoiceRow; lineItems: InvoiceLineItemRow[] } | null>(null);
  const [deleting, setDeleting] = useState<IssuedInvoiceRow | null>(null);
  const [working, setWorking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const todayKey = toMuscatDateInput(new Date());
  const { pageItems, page, setPage, totalPages } = usePagination(invoices);

  async function loadForEdit(invoice: IssuedInvoiceRow) {
    setError(null);
    const res = await fetch(`/api/invoices/${invoice.id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to load invoice");
      return;
    }
    setEditing({ invoice: data.invoice, lineItems: data.lineItems });
  }

  async function handleAction(invoice: IssuedInvoiceRow, action: "mark-sent" | "mark-paid" | "email") {
    setWorking(invoice.id);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/${action}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Action failed");
        return;
      }
      router.refresh();
    } finally {
      setWorking(null);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setWorking(deleting.id);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete invoice");
        return;
      }
      setDeleting(null);
      router.refresh();
    } finally {
      setWorking(null);
    }
  }

  return (
    <div>
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

      <div className="flex justify-end mb-4">
        <span className="btn-glow inline-block">
          <button
            onClick={() => setShowCreate(true)}
            disabled={customers.length === 0}
            className="bg-accent text-ink btn-skew px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            + New Invoice
          </button>
        </span>
      </div>

      {customers.length === 0 && (
        <p className="text-xs text-black/50 dark:text-white/50 mb-4">Add a customer first, from the Customers sub-tab.</p>
      )}

      {invoices.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No invoices yet.</p>
      ) : (
        <div className="space-y-2">
          {pageItems.map((inv) => {
            const overdue = isInvoiceOverdue(inv.status, inv.due_date, todayKey);
            const canEdit = inv.status !== "paid";
            return (
              <HudFrame
                key={inv.id}
                corners="tl-br"
                className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${INVOICE_STATUS_BADGE_CLASS[inv.status]}`}
                    >
                      {INVOICE_STATUS_LABELS[inv.status]}
                    </span>
                    {overdue && (
                      <span className="shrink-0 inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-300">
                        Overdue
                      </span>
                    )}
                    <span className="min-w-0 truncate text-sm font-medium">
                      {inv.invoice_number} — {inv.customer_name}
                    </span>
                  </div>
                  <div className="text-xs text-black/50 dark:text-white/50 truncate">
                    {inv.date}
                    {inv.due_date ? ` · due ${inv.due_date}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <span className="text-sm font-medium">{formatMoney(inv.total, inv.currency)}</span>
                  <a
                    href={`/api/invoices/${inv.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-accent hover:underline"
                  >
                    PDF
                  </a>
                  {inv.status !== "paid" && (
                    <button
                      onClick={() => handleAction(inv, "email")}
                      disabled={working === inv.id}
                      className="text-xs text-accent hover:underline disabled:opacity-50"
                    >
                      Email
                    </button>
                  )}
                  {inv.status === "draft" && (
                    <button
                      onClick={() => handleAction(inv, "mark-sent")}
                      disabled={working === inv.id}
                      className="text-xs text-accent hover:underline disabled:opacity-50"
                    >
                      Mark sent
                    </button>
                  )}
                  {inv.status !== "paid" && (
                    <button
                      onClick={() => handleAction(inv, "mark-paid")}
                      disabled={working === inv.id}
                      className="text-xs text-green-600 dark:text-green-400 hover:underline disabled:opacity-50"
                    >
                      Mark paid
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={() => loadForEdit(inv)} className="text-xs text-accent hover:underline">
                      Edit
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={() => setDeleting(inv)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                      Delete
                    </button>
                  )}
                </div>
              </HudFrame>
            );
          })}
        </div>
      )}
      <PaginationControls page={page} totalPages={totalPages} onChange={setPage} />

      {showCreate && (
        <InvoiceFormModal
          customers={customers}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <InvoiceFormModal
          invoice={editing.invoice}
          lineItems={editing.lineItems}
          customers={customers}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete invoice"
          message={`Delete "${deleting.invoice_number}"?`}
          confirmLabel="Delete"
          loading={working === deleting.id}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
