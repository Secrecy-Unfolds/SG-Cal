import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ProcurementReport } from "@/lib/procurementReports";
import { formatDateOnly, formatMoney } from "@/lib/procurementDisplay";
import { PDF_TEXT } from "@/lib/pdf/theme";
import { ItemizedTable, LabeledValue, Letterhead, PdfFooter } from "@/lib/pdf/primitives";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: PDF_TEXT },
  detailsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 16, marginBottom: 6 },
});

export function ProcurementReportDocument({ report }: { report: ProcurementReport }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Letterhead
          title="Procurement Report"
          subtitle={`${formatDateOnly(report.periodStart)} → ${formatDateOnly(report.periodEnd)}`}
        />

        <View style={styles.detailsRow}>
          <LabeledValue label="Total purchase orders" value={String(report.totalCount)} />
          <LabeledValue label="Pending (not yet closed)" value={String(report.pendingCount)} />
          <LabeledValue label="Closed" value={String(report.closedCount)} />
        </View>

        <Text style={styles.sectionTitle}>Volume &amp; spend by currency</Text>
        {report.byCurrency.length === 0 ? (
          <Text>No purchase orders in this period.</Text>
        ) : (
          <ItemizedTable
            columns={[
              { header: "Currency", width: "34%" },
              { header: "PO count", width: "33%", align: "right" },
              { header: "Total spend", width: "33%", align: "right" },
            ]}
            rows={report.byCurrency.map((r) => [r.currency, String(r.poCount), formatMoney(r.totalSpend, r.currency)])}
          />
        )}

        <PdfFooter />
      </Page>
    </Document>
  );
}

export async function renderProcurementReportPdf(report: ProcurementReport): Promise<Buffer> {
  return renderToBuffer(<ProcurementReportDocument report={report} />);
}
