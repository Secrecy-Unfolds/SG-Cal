import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { VendorInvoiceRow } from "@/lib/vendorInvoices";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";
import { formatDateOnly, formatMoney } from "@/lib/procurementDisplay";
import { PDF_MUTED, PDF_TEXT } from "@/lib/pdf/theme";
import { LabeledValue, Letterhead, PdfFooter } from "@/lib/pdf/primitives";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: PDF_TEXT },
  detailsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  totalLabel: { fontSize: 11, fontWeight: 700, marginRight: 12 },
  totalValue: { fontSize: 12, fontWeight: 700 },
  note: { fontSize: 9, color: PDF_MUTED, marginTop: 24 },
});

// v2 Procurement workflow PDFs — internal record only. The business
// *receives* vendor invoices, it doesn't generate them; this is just a
// clean printable export of a vendor_invoices row already on file, for
// internal recordkeeping/sharing — never sent externally.
export function VendorInvoiceDocument({ invoice, po }: { invoice: VendorInvoiceRow; po: PurchaseOrderRow }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Letterhead title="Vendor Invoice (internal record)" subtitle={invoice.invoice_number || undefined} />

        <View style={styles.detailsRow}>
          <View>
            <LabeledValue label="Vendor" value={po.vendor_name} />
            <LabeledValue label="Purchase order" value={`PO #${po.id}`} />
          </View>
          <View>
            <LabeledValue label="Invoice date" value={formatDateOnly(invoice.invoice_date)} />
            {invoice.due_date ? <LabeledValue label="Due date" value={formatDateOnly(invoice.due_date)} /> : null}
          </View>
        </View>

        <LabeledValue label="Product" value={po.product_name} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Amount</Text>
          <Text style={styles.totalValue}>{formatMoney(invoice.amount, invoice.currency)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Outstanding</Text>
          <Text style={styles.totalValue}>{formatMoney(invoice.outstanding_balance, invoice.currency)}</Text>
        </View>

        <Text style={styles.note}>This is an internal export of an invoice received from the vendor above, not a document issued to them.</Text>

        <PdfFooter />
      </Page>
    </Document>
  );
}

export async function renderVendorInvoicePdf(invoice: VendorInvoiceRow, po: PurchaseOrderRow): Promise<Buffer> {
  return renderToBuffer(<VendorInvoiceDocument invoice={invoice} po={po} />);
}
