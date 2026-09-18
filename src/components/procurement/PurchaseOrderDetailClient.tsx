"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";
import type { GoodsReceiptRow } from "@/lib/goodsReceipts";
import type { VendorInvoiceRow } from "@/lib/vendorInvoices";
import type { VendorPaymentRow } from "@/lib/vendorPayments";
import { PO_STATUS_BADGE_CLASS, PO_STATUS_LABELS } from "@/lib/purchaseOrdersDisplay";
import { computeCapitalNeeded, formatDateOnly, formatMoney } from "@/lib/procurementDisplay";
import { HudFrame } from "@/components/hud/HudFrame";
import PageHeader from "@/components/hud/PageHeader";
import SectionLabel from "@/components/hud/SectionLabel";
import DeliveryDetailsModal from "@/components/procurement/DeliveryDetailsModal";
import GrnFormModal from "@/components/procurement/GrnFormModal";
import VendorInvoiceFormModal from "@/components/procurement/VendorInvoiceFormModal";
import PaymentFormModal from "@/components/procurement/PaymentFormModal";
import ForceCloseModal from "@/components/procurement/ForceCloseModal";

export default function PurchaseOrderDetailClient({
  po,
  receipts,
  invoices,
  payments,
}: {
  po: PurchaseOrderRow;
  receipts: GoodsReceiptRow[];
  invoices: VendorInvoiceRow[];
  payments: Record<number, VendorPaymentRow[]>;
}) {
  const router = useRouter();
  const [showDelivery, setShowDelivery] = useState(false);
  const [showGrn, setShowGrn] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState<VendorInvoiceRow | null>(null);
  const [showForceClose, setShowForceClose] = useState(false);
  const [working, setWorking] = useState(false);
  const [emailingVendor, setEmailingVendor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const poAmount = computeCapitalNeeded({
    unitPrice: po.unit_price,
    quantityNeeded: po.quantity,
    shippingCost: po.shipping_cost,
    customsCost: po.customs_cost,
  });
  const totalReceived = receipts.reduce((sum, r) => sum + r.quantity_received, 0);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.outstanding_balance, 0);

  // 3-Way Match — confirmed "warn, don't block": flags mismatches, never
  // prevents proceeding to payment/closure.
  const qtyMismatch = totalReceived > 0 && totalReceived !== po.quantity;
  const amountMismatch = totalInvoiced > 0 && Math.abs(totalInvoiced - poAmount) > 0.01;

  const closeEligible = receipts.length > 0 && invoices.length > 0 && totalOutstanding <= 0;

  async function refresh() {
    router.refresh();
  }

  async function handleEmailVendor() {
    setEmailingVendor(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/email-vendor`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to email vendor");
        return;
      }
      setNotice("PO emailed to the vendor.");
    } finally {
      setEmailingVendor(false);
    }
  }

  async function handleClose() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to close purchase order");
        return;
      }
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  async function handleForceClose(reason: string) {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to force-close purchase order");
        return;
      }
      setShowForceClose(false);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  const closed = po.status === "closed";

  return (
    <div>
      <Link href="/procurement" className="text-sm text-accent hover:underline">
        ← Back to Procurement
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <PageHeader label="PURCHASE ORDER" title={`${po.product_name} #${po.id}`} />
        <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${PO_STATUS_BADGE_CLASS[po.status]}`}>
          {PO_STATUS_LABELS[po.status]}
        </span>
        <a
          href={`/api/purchase-orders/${po.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent hover:underline"
        >
          Download PO PDF
        </a>
        <button
          type="button"
          onClick={handleEmailVendor}
          disabled={emailingVendor}
          className="text-xs text-accent hover:underline disabled:opacity-50"
        >
          {emailingVendor ? "Sending…" : "Email PO to vendor"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}
      {notice && <p className="text-sm text-green-600 dark:text-green-400 mb-4">{notice}</p>}

      <HudFrame
        corners="all"
        className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <div>
          <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Vendor</div>
          <div className="text-sm">{po.vendor_name}</div>
        </div>
        <div>
          <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Ordered</div>
          <div className="text-sm">{po.quantity} {po.quantity_unit} · {formatDateOnly(po.order_date)}</div>
        </div>
        <div>
          <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">PO amount</div>
          <div className="text-sm">{formatMoney(poAmount, po.currency)}</div>
        </div>
        <div>
          <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Expected arrival</div>
          <div className="text-sm">{po.expected_arrival ? formatDateOnly(po.expected_arrival) : "—"}</div>
        </div>
        {(po.carrier || po.tracking_reference) && (
          <div className="col-span-2">
            <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Carrier / tracking</div>
            <div className="text-sm">{[po.carrier, po.tracking_reference].filter(Boolean).join(" · ") || "—"}</div>
          </div>
        )}
        {!closed && (
          <div className="col-span-2 sm:col-span-4">
            <button type="button" onClick={() => setShowDelivery(true)} className="text-xs text-accent hover:underline">
              Edit delivery details
            </button>
          </div>
        )}
        {closed && po.close_reason && (
          <div className="col-span-2 sm:col-span-4">
            <div className="text-xs text-black/40 dark:text-white/40 uppercase tracking-wide">Force-close reason</div>
            <div className="text-sm">{po.close_reason}</div>
          </div>
        )}
      </HudFrame>

      {/* 3-Way Match — warn, don't block */}
      {(qtyMismatch || amountMismatch) && (
        <HudFrame
          corners="all"
          className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6"
        >
          <SectionLabel>3-WAY MATCH</SectionLabel>
          <div className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">Discrepancies found</div>
          {qtyMismatch && (
            <div className="text-xs text-amber-700 dark:text-amber-300">
              Ordered {po.quantity} {po.quantity_unit}, but GRNs total {totalReceived} {po.quantity_unit} received.
            </div>
          )}
          {amountMismatch && (
            <div className="text-xs text-amber-700 dark:text-amber-300">
              PO amount {formatMoney(poAmount, po.currency)} vs. invoiced total {formatMoney(totalInvoiced, po.currency)}.
            </div>
          )}
          <div className="text-xs text-black/40 dark:text-white/40 mt-1">
            This doesn&apos;t block payment or closure — just flagged for visibility.
          </div>
        </HudFrame>
      )}

      {/* GRN */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>GOODS RECEIPT (GRN)</SectionLabel>
          {!closed && (
            <span className="btn-glow inline-block">
              <button
                onClick={() => setShowGrn(true)}
                className="btn-skew bg-amber-600 text-white px-3 py-1.5 text-xs font-medium"
              >
                + Log GRN
              </button>
            </span>
          )}
        </div>
        {receipts.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">No GRN logged yet — goods haven&apos;t been verified into stock.</p>
        ) : (
          <div className="space-y-2">
            {receipts.map((r) => (
              <HudFrame
                key={r.id}
                corners="tl-br"
                className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-3 text-sm"
              >
                {formatDateOnly(r.date_received)} · {r.quantity_received} {po.quantity_unit} received
                {r.received_by_username ? ` · by ${r.received_by_username}` : ""}
                {r.condition_notes && <div className="text-xs text-black/40 dark:text-white/40 mt-1">{r.condition_notes}</div>}
              </HudFrame>
            ))}
          </div>
        )}
      </div>

      {/* Invoices + Payments */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>VENDOR INVOICES</SectionLabel>
          {!closed && (
            <span className="btn-glow inline-block">
              <button
                onClick={() => setShowInvoice(true)}
                className="btn-skew bg-amber-600 text-white px-3 py-1.5 text-xs font-medium"
              >
                + Log Invoice
              </button>
            </span>
          )}
        </div>
        {invoices.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">No invoice logged yet — no expense has been posted for this PO.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <HudFrame
                key={inv.id}
                corners="tl-br"
                className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-xl p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    {inv.invoice_number ? `#${inv.invoice_number} · ` : ""}
                    {formatDateOnly(inv.invoice_date)} · {formatMoney(inv.amount, inv.currency)}
                    {inv.due_date ? ` · due ${formatDateOnly(inv.due_date)}` : ""}
                  </div>
                  <div className="flex items-center gap-2">
                    {inv.outstanding_balance > 0 ? (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        {formatMoney(inv.outstanding_balance, inv.currency)} outstanding
                      </span>
                    ) : (
                      <span className="text-xs text-green-600 dark:text-green-400">Fully paid</span>
                    )}
                    <a
                      href={`/api/vendor-invoices/${inv.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent hover:underline"
                    >
                      PDF
                    </a>
                    {!closed && inv.outstanding_balance > 0 && (
                      <button
                        type="button"
                        onClick={() => setPayingInvoice(inv)}
                        className="text-xs text-accent hover:underline"
                      >
                        Log payment
                      </button>
                    )}
                  </div>
                </div>
                {(payments[inv.id] ?? []).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/10 space-y-1">
                    {(payments[inv.id] ?? []).map((p) => (
                      <div key={p.id} className="text-xs text-black/50 dark:text-white/50">
                        {formatDateOnly(p.date)} · {formatMoney(p.amount, inv.currency)}
                        {p.method ? ` · ${p.method}` : ""}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </HudFrame>
            ))}
          </div>
        )}
      </div>

      {/* Closure */}
      <div>
        <SectionLabel>CLOSURE</SectionLabel>
        {closed ? (
          <p className="text-sm text-black/50 dark:text-white/50">This purchase order is closed.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="btn-glow inline-block">
              <button
                type="button"
                disabled={!closeEligible || working}
                onClick={handleClose}
                title={!closeEligible ? "Needs a GRN, an invoice, and full payment first" : undefined}
                className="btn-skew bg-accent text-ink px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Close
              </button>
            </span>
            {!closeEligible && (
              <span className="text-xs text-black/40 dark:text-white/40">
                Needs a GRN, an invoice, and full payment before this can close normally.
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowForceClose(true)}
              className="text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              Force close…
            </button>
          </div>
        )}
      </div>

      {showDelivery && (
        <DeliveryDetailsModal po={po} onClose={() => setShowDelivery(false)} onSaved={() => { setShowDelivery(false); refresh(); }} />
      )}
      {showGrn && (
        <GrnFormModal po={po} onClose={() => setShowGrn(false)} onSaved={() => { setShowGrn(false); refresh(); }} />
      )}
      {showInvoice && (
        <VendorInvoiceFormModal po={po} onClose={() => setShowInvoice(false)} onSaved={() => { setShowInvoice(false); refresh(); }} />
      )}
      {payingInvoice && (
        <PaymentFormModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onSaved={() => { setPayingInvoice(null); refresh(); }}
        />
      )}
      {showForceClose && <ForceCloseModal onClose={() => setShowForceClose(false)} onConfirm={handleForceClose} />}
    </div>
  );
}
