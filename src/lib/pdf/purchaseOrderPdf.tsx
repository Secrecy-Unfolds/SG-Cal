import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { PurchaseOrderRow } from "@/lib/purchaseOrders";
import type { VendorRow } from "@/lib/procurement";
import { computeCapitalNeeded, formatDateOnly, formatMoney } from "@/lib/procurementDisplay";
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

// Procurement's outbound PO document — v2 Procurement workflow PDFs.
// Vendor contact details (Phase 1) are shown when present, since this is
// the actual document that would be sent to that vendor.
export function PurchaseOrderDocument({ po, vendor }: { po: PurchaseOrderRow; vendor: VendorRow | null }) {
  const amount = computeCapitalNeeded({
    unitPrice: po.unit_price,
    quantityNeeded: po.quantity,
    shippingCost: po.shipping_cost,
    customsCost: po.customs_cost,
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Letterhead title="Purchase Order" subtitle={`PO #${po.id}`} />

        <View style={styles.detailsRow}>
          <View>
            <LabeledValue label="Vendor" value={po.vendor_name} />
            {vendor?.email ? <LabeledValue label="Email" value={vendor.email} /> : null}
            {vendor?.phone ? <LabeledValue label="Phone" value={vendor.phone} /> : null}
          </View>
          <View>
            <LabeledValue label="Order date" value={formatDateOnly(po.order_date)} />
            {po.expected_arrival ? <LabeledValue label="Expected arrival" value={formatDateOnly(po.expected_arrival)} /> : null}
            <LabeledValue label="Currency" value={po.currency} />
          </View>
        </View>

        <ItemizedTable
          columns={[
            { header: "Item", width: "34%" },
            { header: "Qty", width: "14%", align: "right" },
            { header: "Unit price", width: "17%", align: "right" },
            { header: "Shipping", width: "17%", align: "right" },
            { header: "Customs", width: "18%", align: "right" },
          ]}
          rows={[
            [
              po.product_name,
              `${po.quantity} ${po.quantity_unit}`,
              formatMoney(po.unit_price, po.currency),
              formatMoney(po.shipping_cost, po.currency),
              formatMoney(po.customs_cost, po.currency),
            ],
          ]}
        />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatMoney(amount, po.currency)}</Text>
        </View>

        {(po.payment_terms || po.warranty || po.delivery_period) && (
          <View style={{ marginTop: 16 }}>
            {po.payment_terms ? <LabeledValue label="Payment terms" value={po.payment_terms} /> : null}
            {po.delivery_period ? <LabeledValue label="Delivery period" value={po.delivery_period} /> : null}
            {po.warranty ? <LabeledValue label="Warranty" value={po.warranty} /> : null}
          </View>
        )}

        <Text style={styles.note}>Please confirm receipt of this purchase order.</Text>

        <PdfFooter />
      </Page>
    </Document>
  );
}

export async function renderPurchaseOrderPdf(po: PurchaseOrderRow, vendor: VendorRow | null): Promise<Buffer> {
  return renderToBuffer(<PurchaseOrderDocument po={po} vendor={vendor} />);
}
