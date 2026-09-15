import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { BalanceSummaryRow, ProfitAndLossRow } from "@/lib/financialStatements";
import { formatMoney } from "@/lib/procurementDisplay";
import { PDF_TEXT } from "@/lib/pdf/theme";
import { ItemizedTable, Letterhead, PdfFooter } from "@/lib/pdf/primitives";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: PDF_TEXT },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 18, marginBottom: 4 },
});

// Covers both "Financial statement PDFs" and "Period + status reports as
// PDFs" from the roadmap — both are the same P&L + balance-summary render
// over whatever period/range the caller picks (a week, a month, a quarter,
// a year), so one document type serves both rather than two near-identical
// generators.
export function StatementDocument({
  periodStart,
  periodEnd,
  profitAndLoss,
  balanceSummary,
}: {
  periodStart: string;
  periodEnd: string;
  profitAndLoss: ProfitAndLossRow[];
  balanceSummary: BalanceSummaryRow[];
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Letterhead title="Financial statement" subtitle={`${periodStart} → ${periodEnd}`} />

        <Text style={styles.sectionTitle}>Profit &amp; loss</Text>
        {profitAndLoss.length === 0 ? (
          <Text>No approved transactions in this period.</Text>
        ) : (
          <ItemizedTable
            columns={[
              { header: "Currency", width: "20%" },
              { header: "Income", width: "20%", align: "right" },
              { header: "Expense", width: "20%", align: "right" },
              { header: "Net", width: "20%", align: "right" },
              { header: "VAT net owed", width: "20%", align: "right" },
            ]}
            rows={profitAndLoss.map((r) => [
              r.currency,
              formatMoney(r.income, r.currency),
              formatMoney(r.expense, r.currency),
              formatMoney(r.net, r.currency),
              formatMoney(r.vatCollected - r.vatPaid, r.currency),
            ])}
          />
        )}

        <Text style={styles.sectionTitle}>Balance summary</Text>
        {balanceSummary.length === 0 ? (
          <Text>No inventory, account, or loan data yet.</Text>
        ) : (
          <ItemizedTable
            columns={[
              { header: "Currency", width: "20%" },
              { header: "Inventory", width: "20%", align: "right" },
              { header: "Cash/Bank", width: "20%", align: "right" },
              { header: "Loans owed", width: "20%", align: "right" },
              { header: "Net position", width: "20%", align: "right" },
            ]}
            rows={balanceSummary.map((r) => [
              r.currency,
              formatMoney(r.inventoryValue, r.currency),
              formatMoney(r.cashAndBankBalance, r.currency),
              formatMoney(r.outstandingLoans, r.currency),
              formatMoney(r.netPosition, r.currency),
            ])}
          />
        )}

        <PdfFooter />
      </Page>
    </Document>
  );
}

export async function renderStatementPdf(
  periodStart: string,
  periodEnd: string,
  profitAndLoss: ProfitAndLossRow[],
  balanceSummary: BalanceSummaryRow[]
): Promise<Buffer> {
  return renderToBuffer(
    <StatementDocument periodStart={periodStart} periodEnd={periodEnd} profitAndLoss={profitAndLoss} balanceSummary={balanceSummary} />
  );
}
