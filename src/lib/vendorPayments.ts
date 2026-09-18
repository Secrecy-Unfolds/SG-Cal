import { query } from "@/lib/db";

// v2 Procurement workflow Phase 2 — Payment. Lets one invoice be paid
// across multiple payments, with an outstanding balance computed live
// (VendorInvoiceRow.outstanding_balance, in vendorInvoices.ts) — instead
// of the old single auto-posted transaction implicitly meaning "fully
// paid, immediately, in one shot."

export type VendorPaymentRow = {
  id: number;
  vendor_invoice_id: number;
  amount: string; // numeric comes back as a string from pg
  date: string; // "YYYY-MM-DD"
  method: string;
  reference: string;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

const SELECT = `
  SELECT p.id, p.vendor_invoice_id, p.amount, p.date, p.method, p.reference,
         p.created_by, u.username AS created_by_username, p.created_at
  FROM vendor_payments p
  LEFT JOIN users u ON u.id = p.created_by
`;

export async function listPaymentsForInvoice(invoiceId: number): Promise<VendorPaymentRow[]> {
  const res = await query<VendorPaymentRow>(`${SELECT} WHERE p.vendor_invoice_id = $1 ORDER BY p.date ASC, p.id ASC`, [
    invoiceId,
  ]);
  return res.rows;
}

export async function createPayment(input: {
  vendorInvoiceId: number;
  amount: number;
  date: string;
  method: string;
  reference: string;
  createdBy: number;
}): Promise<VendorPaymentRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO vendor_payments (vendor_invoice_id, amount, date, method, reference, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [input.vendorInvoiceId, input.amount, input.date, input.method, input.reference, input.createdBy]
  );
  const res2 = await query<VendorPaymentRow>(`${SELECT} WHERE p.id = $1`, [res.rows[0].id]);
  return res2.rows[0];
}

export async function deletePayment(id: number): Promise<void> {
  await query(`DELETE FROM vendor_payments WHERE id = $1`, [id]);
}
