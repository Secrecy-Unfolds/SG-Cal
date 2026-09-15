import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { CustomerRow } from "@/lib/customers";
import type { InvoiceLineItemRow, IssuedInvoiceRow } from "@/lib/invoices";
import { formatMoney } from "@/lib/procurementDisplay";
import { PDF_MUTED, PDF_TEXT } from "@/lib/pdf/theme";
import { ItemizedTable, LabeledValue, Letterhead, PdfFooter } from "@/lib/pdf/primitives";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: PDF_TEXT },
  detailsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  totalLabel: { fontSize: 11, fontWeight: 700, marginRight: 12 },
  totalValue: { fontSize: 12, fontWeight: 700 },
  note: { fontSize: 9, color: PDF_MUTED, marginTop: 24 },
});

export function InvoiceDocument({
  invoice,
  lineItems,
  customer,
}: {
  invoice: IssuedInvoiceRow;
  lineItems: InvoiceLineItemRow[];
  customer: CustomerRow;
}) {
  const total = lineItems.reduce((sum, li) => sum + parseFloat(li.line_amount), 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Letterhead title="Invoice" subtitle={invoice.invoice_number} />

        <View style={styles.detailsRow}>
          <View>
            <LabeledValue label="Bill to" value={customer.name} />
            {customer.address ? <LabeledValue label="Address" value={customer.address} /> : null}
            {customer.email ? <LabeledValue label="Email" value={customer.email} /> : null}
          </View>
          <View>
            <LabeledValue label="Date" value={invoice.date} />
            {invoice.due_date ? <LabeledValue label="Due date" value={invoice.due_date} /> : null}
            <LabeledValue label="Currency" value={invoice.currency} />
          </View>
        </View>

        <ItemizedTable
          columns={[
            { header: "Description", width: "46%" },
            { header: "Qty", width: "14%", align: "right" },
            { header: "Unit price", width: "20%", align: "right" },
            { header: "Amount", width: "20%", align: "right" },
          ]}
          rows={lineItems.map((li) => [
            li.description || "—",
            li.quantity,
            formatMoney(li.unit_price, invoice.currency),
            formatMoney(li.line_amount, invoice.currency),
          ])}
        />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatMoney(total, invoice.currency)}</Text>
        </View>

        <Text style={styles.note}>
          Please remit payment by the due date shown above. Contact us if you have any questions about this invoice.
        </Text>

        <PdfFooter />
      </Page>
    </Document>
  );
}

// Kept as a plain-.ts-callable function (no JSX at the call site) so
// route.ts files that need the buffer don't have to become .tsx themselves.
export async function renderInvoicePdf(invoice: IssuedInvoiceRow, lineItems: InvoiceLineItemRow[], customer: CustomerRow): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument invoice={invoice} lineItems={lineItems} customer={customer} />);
}
