import { redirect } from "next/navigation";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Boxes, CalendarCheck, CalendarClock, Lightbulb, Package, UserCheck, Wallet } from "lucide-react";
import { getSession } from "@/lib/auth";
import { isAdminLevel, listUsers } from "@/lib/users";
import { listEventsForRecipient } from "@/lib/events";
import { eventBadgeClass, eventTypeLabel, formatEventWhen } from "@/lib/eventDisplay";
import { getAttendanceForDate, listAllAttendance, listAllLeaveRequests, listLeaveRequestsForUser } from "@/lib/hr";
import { listPurchaseOrders } from "@/lib/purchaseOrders";
import { listInventoryItems } from "@/lib/inventory";
import { listTransactions } from "@/lib/accounting";
import { listIdeas } from "@/lib/ideas";
import { toMuscatDateInput } from "@/lib/time";
import { formatMoney } from "@/lib/procurementDisplay";
import PageHeader from "@/components/hud/PageHeader";
import SectionLabel from "@/components/hud/SectionLabel";
import { HudFrame } from "@/components/hud/HudFrame";
import StatTile from "@/components/hud/StatTile";

type Tile = { icon: LucideIcon; value: string | number; label: string };

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { uid, role } = session;
  const admin = isAdminLevel(role);
  const todayKey = toMuscatDateInput(new Date());
  const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [agenda, myLeaveRequests, myAttendanceToday, adminData] = await Promise.all([
    listEventsForRecipient(new Date(), sevenDaysOut, uid, role),
    listLeaveRequestsForUser(uid),
    getAttendanceForDate(uid, todayKey),
    admin
      ? Promise.all([
          listUsers(),
          listAllLeaveRequests(),
          listAllAttendance(),
          listPurchaseOrders(),
          listInventoryItems(),
          listTransactions(),
          listIdeas(),
        ])
      : Promise.resolve(null),
  ]);

  const myPendingLeave = myLeaveRequests.filter((r) => r.status === "pending").length;
  const attendanceLabel = !myAttendanceToday ? "Not in yet" : !myAttendanceToday.check_out_at ? "Checked in" : "Checked out";

  const tiles: Tile[] = [
    { icon: CalendarClock, value: myPendingLeave, label: "My leave pending" },
    { icon: UserCheck, value: attendanceLabel, label: "My attendance today" },
  ];

  if (admin && adminData) {
    const [allUsers, allLeave, allAttendance, purchaseOrders, inventoryItems, transactions, ideas] = adminData;

    const openPOs = purchaseOrders.filter((po) => po.status === "ordered" || po.status === "in_transit").length;
    const pendingLeaveOrgWide = allLeave.filter((r) => r.status === "pending").length;
    const checkedInToday = new Set(
      allAttendance.filter((a) => a.work_date === todayKey).map((a) => a.user_id)
    ).size;

    // Currency here is free text (same convention as Procurement Planning
    // and Accounting) — totals are kept per-currency, never blended, same
    // as TransactionsListClient's totalsByCurrency.
    const inventoryByCurrency = new Map<string, number>();
    for (const item of inventoryItems) {
      const value = parseFloat(item.current_value ?? item.purchase_cost ?? "0");
      if (!Number.isFinite(value)) continue;
      inventoryByCurrency.set(item.currency, (inventoryByCurrency.get(item.currency) ?? 0) + value);
    }

    const ledgerByCurrency = new Map<string, { income: number; expense: number }>();
    for (const t of transactions) {
      const entry = ledgerByCurrency.get(t.currency) ?? { income: 0, expense: 0 };
      entry[t.type] += parseFloat(t.amount);
      ledgerByCurrency.set(t.currency, entry);
    }

    tiles.push(
      { icon: Package, value: openPOs, label: "Open purchase orders" },
      { icon: CalendarCheck, value: pendingLeaveOrgWide, label: "Leave requests pending" },
      { icon: UserCheck, value: `${checkedInToday} / ${allUsers.length}`, label: "Checked in today" },
      ...Array.from(inventoryByCurrency.entries()).map(([currency, value]) => ({
        icon: Boxes,
        value: formatMoney(value, currency),
        label: `Inventory value (${currency})`,
      })),
      ...Array.from(ledgerByCurrency.entries()).map(([currency, { income, expense }]) => ({
        icon: Wallet,
        value: formatMoney(income - expense, currency),
        label: `Ledger net (${currency})`,
      })),
      { icon: Lightbulb, value: ideas.length, label: "Ideas logged" }
    );
  }

  return (
    <div>
      <PageHeader label="OVERVIEW" title="Dashboard" />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {tiles.map((tile, i) => (
          <StatTile key={i} icon={tile.icon} value={tile.value} label={tile.label} />
        ))}
      </div>

      <SectionLabel className="mb-2">Upcoming</SectionLabel>
      <HudFrame
        corners="tl-br"
        className="bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-4"
      >
        {agenda.length === 0 ? (
          <p className="text-sm text-black/40 dark:text-white/40">Nothing on your calendar in the next 7 days.</p>
        ) : (
          <div className="space-y-3">
            {agenda.slice(0, 6).map((ev) => {
              const display = {
                type: ev.type,
                is_tentative: ev.is_tentative,
                start_at: ev.start_at.toISOString(),
                end_at: ev.end_at ? ev.end_at.toISOString() : null,
                status: ev.status,
              };
              return (
                <div key={ev.id} className="text-sm">
                  <span
                    className={`inline-block text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 mb-1 ${eventBadgeClass(display)}`}
                  >
                    {eventTypeLabel(display)}
                  </span>
                  <div className="font-medium truncate">{ev.title}</div>
                  <div className="text-xs text-black/50 dark:text-white/50">{formatEventWhen(display)}</div>
                </div>
              );
            })}
          </div>
        )}
        <Link href="/calendar" className="inline-block mt-4 text-xs text-accent hover:underline">
          View full calendar →
        </Link>
      </HudFrame>
    </div>
  );
}
