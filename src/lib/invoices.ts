import { randomBytes } from "crypto";
import { query } from "@/lib/db";
import { getCustomerById } from "@/lib/customers";
import type { InvoiceStatus } from "@/lib/invoicesDisplay";

export type IssuedInvoiceRow = {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  invoice_number: string;
  currency: string;
  date: string; // "YYYY-MM-DD"
  due_date: string | null;
  status: InvoiceStatus;
  access_token: string;
  transaction_id: number | null;
  total: string; // live-computed sum of line items, never stored
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
  updated_at: Date;
};

const INVOICE_SELECT = `
  SELECT i.id, i.customer_id, c.name AS customer_name, c.email AS customer_email,
         i.invoice_number, i.currency, i.date, i.due_date, i.status, i.access_token, i.transaction_id,
         COALESCE((SELECT SUM(li.line_amount) FROM invoice_line_items li WHERE li.invoice_id = i.id), 0) AS total,
         i.created_by, u.username AS created_by_username, i.created_at, i.updated_at
  FROM issued_invoices i
  JOIN customers c ON c.id = i.customer_id
  LEFT JOIN users u ON u.id = i.created_by
`;

export async function listInvoices(): Promise<IssuedInvoiceRow[]> {
  const res = await query<IssuedInvoiceRow>(`${INVOICE_SELECT} ORDER BY i.date DESC, i.id DESC`);
  return res.rows;
}

export async function getInvoiceById(id: number): Promise<IssuedInvoiceRow | null> {
  const res = await query<IssuedInvoiceRow>(`${INVOICE_SELECT} WHERE i.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function getInvoiceByToken(token: string): Promise<IssuedInvoiceRow | null> {
  const res = await query<IssuedInvoiceRow>(`${INVOICE_SELECT} WHERE i.access_token = $1`, [token]);
  return res.rows[0] ?? null;
}

export type InvoiceLineItemRow = {
  id: number;
  invoice_id: number;
  description: string;
  quantity: string;
  unit_price: string;
  line_amount: string;
  sort_order: number;
};

export async function listLineItemsForInvoice(invoiceId: number): Promise<InvoiceLineItemRow[]> {
  const res = await query<InvoiceLineItemRow>(
    `SELECT id, invoice_id, description, quantity, unit_price, line_amount, sort_order
     FROM invoice_line_items WHERE invoice_id = $1 ORDER BY sort_order ASC, id ASC`,
    [invoiceId]
  );
  return res.rows;
}

export type LineItemInput = { description: string; quantity: number; unitPrice: number };

async function replaceLineItems(invoiceId: number, items: LineItemInput[]): Promise<void> {
  await query(`DELETE FROM invoice_line_items WHERE invoice_id = $1`, [invoiceId]);
  let sortOrder = 0;
  for (const item of items) {
    await query(
      `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, line_amount, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [invoiceId, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice, sortOrder]
    );
    sortOrder++;
  }
}

// invoice_number is backfilled right after insert — it needs the row's own
// id (format "INV-00042"). access_token is a random, unguessable string
// used only by the public PDF share-link route.
export async function createInvoice(input: {
  customerId: number;
  currency: string;
  date: string;
  dueDate: string | null;
  lineItems: LineItemInput[];
  createdBy: number;
}): Promise<IssuedInvoiceRow> {
  const customer = await getCustomerById(input.customerId);
  if (!customer) throw new Error("Customer not found");

  const accessToken = randomBytes(24).toString("hex");
  const res = await query<{ id: number }>(
    `INSERT INTO issued_invoices (customer_id, currency, date, due_date, access_token, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.customerId, input.currency, input.date, input.dueDate, accessToken, input.createdBy]
  );
  const id = res.rows[0].id;
  await query(`UPDATE issued_invoices SET invoice_number = $1 WHERE id = $2`, [`INV-${String(id).padStart(5, "0")}`, id]);
  await replaceLineItems(id, input.lineItems);

  const created = await getInvoiceById(id);
  if (!created) throw new Error("Failed to load created invoice");
  return created;
}

// Blocked once 'paid' — a paid invoice is a settled financial record, same
// "don't silently change something already reported" precedent as period
// closing.
export async function updateInvoice(
  id: number,
  input: { customerId: number; currency: string; date: string; dueDate: string | null; lineItems: LineItemInput[] }
): Promise<IssuedInvoiceRow | null> {
  const existing = await getInvoiceById(id);
  if (!existing) return null;
  if (existing.status === "paid") throw new Error("INVOICE_PAID");

  await query(
    `UPDATE issued_invoices SET customer_id = $1, currency = $2, date = $3, due_date = $4, updated_at = now() WHERE id = $5`,
    [input.customerId, input.currency, input.date, input.dueDate, id]
  );
  await replaceLineItems(id, input.lineItems);
  return getInvoiceById(id);
}

export async function markInvoiceSent(id: number): Promise<IssuedInvoiceRow | null> {
  await query(`UPDATE issued_invoices SET status = 'sent', updated_at = now() WHERE id = $1 AND status = 'draft'`, [id]);
  return getInvoiceById(id);
}

// Auto-posts an Accounting income transaction — mirrors
// postExpenseForPurchaseOrder()'s direct-insert pattern in lib/accounting.ts
// (always 'approved' immediately, income never goes through the
// expense-approval threshold, and — like PO-received/payroll — posted
// dated today rather than the invoice's own issue date).
export async function markInvoicePaid(id: number): Promise<IssuedInvoiceRow | null> {
  const invoice = await getInvoiceById(id);
  if (!invoice) return null;
  if (invoice.status === "paid") return invoice;

  const res = await query<{ id: number }>(
    `INSERT INTO accounting_transactions (date, description, amount, currency, type, category, status)
     VALUES (CURRENT_DATE, $1, $2, $3, 'income', 'Customer invoice', 'approved') RETURNING id`,
    [`${invoice.invoice_number} — ${invoice.customer_name}`, invoice.total, invoice.currency]
  );

  await query(`UPDATE issued_invoices SET status = 'paid', transaction_id = $1, updated_at = now() WHERE id = $2`, [
    res.rows[0].id,
    id,
  ]);
  return getInvoiceById(id);
}

// Blocked once 'paid' — same reasoning as updateInvoice(). The
// accounting_transactions row it posted is kept regardless (deleting the
// invoice doesn't apply once paid, so this path never touches it).
export async function deleteInvoice(id: number): Promise<void> {
  const existing = await getInvoiceById(id);
  if (existing && existing.status === "paid") throw new Error("INVOICE_PAID");
  await query(`DELETE FROM issued_invoices WHERE id = $1`, [id]);
}
