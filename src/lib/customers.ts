import { query } from "@/lib/db";

export type CustomerRow = {
  id: number;
  name: string;
  contact: string;
  email: string;
  address: string;
  created_by: number | null;
  created_by_username: string | null;
  created_at: Date;
};

const CUSTOMER_SELECT = `
  SELECT c.id, c.name, c.contact, c.email, c.address, c.created_by, u.username AS created_by_username, c.created_at
  FROM customers c
  LEFT JOIN users u ON u.id = c.created_by
`;

export async function listCustomers(): Promise<CustomerRow[]> {
  const res = await query<CustomerRow>(`${CUSTOMER_SELECT} ORDER BY c.name`);
  return res.rows;
}

export async function getCustomerById(id: number): Promise<CustomerRow | null> {
  const res = await query<CustomerRow>(`${CUSTOMER_SELECT} WHERE c.id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function createCustomer(input: {
  name: string;
  contact: string;
  email: string;
  address: string;
  createdBy: number;
}): Promise<CustomerRow> {
  const res = await query<{ id: number }>(
    `INSERT INTO customers (name, contact, email, address, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.name, input.contact, input.email, input.address, input.createdBy]
  );
  const created = await getCustomerById(res.rows[0].id);
  if (!created) throw new Error("Failed to load created customer");
  return created;
}

export async function updateCustomer(
  id: number,
  input: { name: string; contact: string; email: string; address: string }
): Promise<CustomerRow | null> {
  await query(`UPDATE customers SET name = $1, contact = $2, email = $3, address = $4 WHERE id = $5`, [
    input.name,
    input.contact,
    input.email,
    input.address,
    id,
  ]);
  return getCustomerById(id);
}

// Cascades via the schema's FK: issued_invoices.customer_id is ON DELETE
// CASCADE, so this also removes the customer's invoices and their line
// items. The accounting_transactions rows a paid invoice posted are kept
// (same convention as deleting an investor/supporter).
export async function deleteCustomer(id: number): Promise<void> {
  await query(`DELETE FROM customers WHERE id = $1`, [id]);
}
