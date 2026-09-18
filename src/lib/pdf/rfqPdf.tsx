import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ProductRow, ProductVendorRow } from "@/lib/procurement";
import { formatDateOnly } from "@/lib/procurementDisplay";
import { PDF_MUTED, PDF_TEXT } from "@/lib/pdf/theme";
import { LabeledValue, Letterhead, PdfFooter } from "@/lib/pdf/primitives";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: PDF_TEXT },
  detailsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  description: { fontSize: 10, color: PDF_TEXT, marginTop: 12, lineHeight: 1.4 },
  note: { fontSize: 9, color: PDF_MUTED, marginTop: 24 },
});

// v2 Procurement workflow Phase 2's RFQ — a formal document attached to
// the outbound RFQ email (rfqEmail() in procurementEmailTemplates.ts).
// Asks for a quote, so deliberately has no price/total on it.
export function RfqDocument({ product, vendor }: { product: ProductRow; vendor: ProductVendorRow }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Letterhead title="Request for Quotation" subtitle={`For: ${vendor.name}`} />

        <View style={styles.detailsRow}>
          <View>
            <LabeledValue label="Item" value={product.name} />
            <LabeledValue label="Quantity needed" value={`${product.quantity_needed} ${product.quantity_unit}`} />
          </View>
          <View>
            {product.required_by ? <LabeledValue label="Needed by" value={formatDateOnly(product.required_by)} /> : null}
            <LabeledValue label="Date" value={formatDateOnly(new Date().toISOString().slice(0, 10))} />
          </View>
        </View>

        {product.description ? <Text style={styles.description}>{product.description}</Text> : null}

        <Text style={styles.note}>
          Please reply with your quotation, including pricing, payment terms, delivery period, and warranty.
        </Text>

        <PdfFooter />
      </Page>
    </Document>
  );
}

export async function renderRfqPdf(product: ProductRow, vendor: ProductVendorRow): Promise<Buffer> {
  return renderToBuffer(<RfqDocument product={product} vendor={vendor} />);
}
