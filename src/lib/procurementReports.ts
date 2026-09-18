import { listPurchaseOrders } from "@/lib/purchaseOrders";
import { computeCapitalNeeded } from "@/lib/procurementDisplay";

// v2 Procurement PDFs — "Procurement reports" item. A reporting view over
// existing purchase_orders data (no new ledger model), same "compute live
// over a chosen period" pattern as lib/financialStatements.ts. Weekly/
// monthly/quarterly/annual is just whatever date range is picked, same as
// the Accounting Statements tab.

export type ProcurementSpendRow = {
  currency: string;
  poCount: number;
  totalSpend: number;
};

export type ProcurementReport = {
  periodStart: string;
  periodEnd: string;
  byCurrency: ProcurementSpendRow[];
  // "pending" = hasn't reached Closure yet, "closed" = has — confirmed
  // definition from docs/erp-v2-roadmap.md's Procurement PDFs item.
  pendingCount: number;
  closedCount: number;
  totalCount: number;
};

export async function computeProcurementReport(periodStart: string, periodEnd: string): Promise<ProcurementReport> {
  const orders = await listPurchaseOrders();
  const inRange = orders.filter((po) => po.order_date >= periodStart && po.order_date <= periodEnd);

  const map = new Map<string, ProcurementSpendRow>();
  let pendingCount = 0;
  let closedCount = 0;
  for (const po of inRange) {
    const spend = computeCapitalNeeded({
      unitPrice: po.unit_price,
      quantityNeeded: po.quantity,
      shippingCost: po.shipping_cost,
      customsCost: po.customs_cost,
    });
    const row = map.get(po.currency) ?? { currency: po.currency, poCount: 0, totalSpend: 0 };
    row.poCount += 1;
    row.totalSpend += spend;
    map.set(po.currency, row);

    if (po.status === "closed") closedCount += 1;
    else pendingCount += 1;
  }

  return {
    periodStart,
    periodEnd,
    byCurrency: Array.from(map.values()),
    pendingCount,
    closedCount,
    totalCount: inRange.length,
  };
}
