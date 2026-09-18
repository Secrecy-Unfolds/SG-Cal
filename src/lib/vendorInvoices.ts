import { query } from "@/lib/db";
import { getPurchaseOrderById } from "@/lib/purchaseOrders";
import { getTransactionById } from "@/lib/accounting";
import type { AccountingTransactionRow } from "@/lib/accounting";

// v2 Procurement workflow Phase 2 — Vendor Invoice. Now the real source of
// the Accounting expense transaction a PO posts, replacing the old direct
// Received-status-triggers-expense link — distinct from (and now standing
// in for) the invoice that transaction used to implicitly represent.

export type VendorInvoiceRow = {
  id: number;
  purchase_order_id: number;
  invoice_number: string;
  invoice_date: string; // "YYYY-MM-DD"
  amount: string; // numeric comes back as a string from pg
  currency: string;
  due_date: string | null;
  transaction_id: number | null;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
  paid_amount: number; // sum of its vendor_payments, computed live
  outstanding_balance: number; // amount - paid_amount, computed live
};

const SELECT = `
  SELECT vi.id, vi.purchase_order_id, vi.invoice_number, vi.invoice_date, vi.amount, vi.currency,
         vi.due_date, vi.transaction_id, vi.created_by, u.username AS created_by_username, vi.created_at,
         COALESCE((SELECT SUM(vp.amount) FROM vendor_payments vp WHERE vp.vendor_invoice_id = vi.id), 0) AS paid_amount
  FROM vendor_invoices vi
  LEFT JOIN users u ON u.id = vi.created_by
`;

function withBalance(row: any): VendorInvoiceRow {
  const amount = parseFloat(row.amount);
  const paid = parseFloat(row.paid_amount);
  return { ...row, paid_amount: paid, outstanding_balance: Math.max(0, Math.round((amount - paid) * 100) / 100) };
}

export async function listVendorInvoicesForPO(poId: number): Promise<VendorInvoiceRow[]> {
  const res = await query(`${SELECT} WHERE vi.purchase_order_id = $1 ORDER BY vi.created_at ASC`, [poId]);
  return res.rows.map(withBalance);
}

export async function getVendorInvoiceById(id: number): Promise<VendorInvoiceRow | null> {
  const res = await query(`${SELECT} WHERE vi.id = $1`, [id]);
  return res.rows[0] ? withBalance(res.rows[0]) : null;
}

// Direct-insert, always 'approved' immediately (accounting_transactions'
// status column defaults to 'approved') — same as every other "already
// the result of an approved action elsewhere" auto-posting in this app
// (a received PO used to post this way, a run payroll still does), not
// routed through createTransaction()'s manual-entry approval-threshold
// gate. Uses the invoice's own entered amount, not a recomputed PO figure.
export async function createVendorInvoice(input: {
  purchaseOrderId: number;
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  currency: string;
  dueDate: string | null;
  createdBy: number;
}): Promise<{ invoice: VendorInvoiceRow; transaction: AccountingTransactionRow }> {
  const po = await getPurchaseOrderById(input.purchaseOrderId);
  if (!po) throw new Error("Purchase order not found");

  const description = `${po.product_name} (PO #${po.id}, ${po.vendor_name})${
    input.invoiceNumber ? ` — Invoice ${input.invoiceNumber}` : ""
  }`;
  const txRes = await query<{ id: number }>(
    `INSERT INTO accounting_transactions (date, description, amount, currency, type, category, purchase_order_id)
     VALUES ($1, $2, $3, $4, 'expense', 'Procurement', $5) RETURNING id`,
    [input.invoiceDate, description, input.amount, input.currency, po.id]
  );
  const transaction = await getTransactionById(txRes.rows[0].id);
  if (!transaction) throw new Error("Failed to load created transaction");

  const invRes = await query<{ id: number }>(
    `INSERT INTO vendor_invoices (purchase_order_id, invoice_number, invoice_date, amount, currency, due_date, transaction_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [
      input.purchaseOrderId,
      input.invoiceNumber,
      input.invoiceDate,
      input.amount,
      input.currency,
      input.dueDate,
      transaction.id,
      input.createdBy,
    ]
  );
  const invoice = await getVendorInvoiceById(invRes.rows[0].id);
  if (!invoice) throw new Error("Failed to load created invoice");
  return { invoice, transaction };
}

// Doesn't delete the posted transaction — same "don't silently unwind a
// different module's record" caution as goods receipts not deleting their
// linked Inventory item. Delete the transaction from the Ledger directly
// if that's actually intended.
export async function deleteVendorInvoice(id: number): Promise<void> {
  await query(`DELETE FROM vendor_invoices WHERE id = $1`, [id]);
}
