"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Settings as SettingsIcon,
  Sun,
  User,
  UserCog,
  Wallet,
  X,
} from "lucide-react";
import type { UserRole } from "@/lib/users";
import RadarBackground from "@/components/hud/RadarBackground";

// Mirrors lib/users.ts's ROLE_LABELS/role badge styling — duplicated here
// (not imported) since that module pulls in `pg` via lib/db.ts and this is
// a client component; same pattern as eventDisplay.ts/procurementDisplay.ts.
const ROLE_LABELS: Record<UserRole, string> = {
  user: "User",
  admin: "Admin",
  super_admin: "Super Admin",
};

const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  super_admin: "bg-violet-500/10 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300",
  admin: "bg-accent/10 dark:bg-accent/20 text-accent dark:text-blue-300",
  user: "bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60",
};

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false, superAdminOnly: false },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon, adminOnly: false, superAdminOnly: false },
  { href: "/procurement", label: "Procurement", icon: Package, adminOnly: true, superAdminOnly: false },
  { href: "/inventory", label: "Inventory", icon: Boxes, adminOnly: true, superAdminOnly: false },
  { href: "/accounting", label: "Accounting", icon: Wallet, adminOnly: true, superAdminOnly: false },
  { href: "/hr", label: "HR", icon: UserCog, adminOnly: true, superAdminOnly: false },
  { href: "/ideas", label: "Ideas", icon: Lightbulb, adminOnly: true, superAdminOnly: false },
  { href: "/settings", label: "Settings", icon: SettingsIcon, adminOnly: false, superAdminOnly: true },
  { href: "/profile", label: "Profile", icon: User, adminOnly: false, superAdminOnly: false },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShell({
  session,
  presentCount = 0,
  children,
}: {
  session: { uid: number; username: string; role: UserRole };
  presentCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    try {
      setCollapsed(localStorage.getItem("sidebarCollapsed") === "1");
    } catch {}
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("sidebarCollapsed", next ? "1" : "0");
    } catch {}
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isAdmin = session.role !== "user";
  const isSuperAdmin = session.role === "super_admin";
  const visibleItems = NAV_ITEMS.filter(
    (item) => (!item.adminOnly || isAdmin) && (!item.superAdminOnly || isSuperAdmin)
  );
  const activeItem = visibleItems.find((item) => isActive(pathname, item.href));

  function renderSidebar(collapsedView: boolean) {
    return (
      <div className="flex flex-col h-full">
        <div className={`py-5 flex items-center ${collapsedView ? "justify-center px-3" : "justify-between px-5"}`}>
          {collapsedView ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-square-navy.png" alt="SG-ERP" className="h-7 w-7 dark:hidden" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-square-white.png" alt="SG-ERP" className="h-7 w-7 hidden dark:block" />
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-wide-navy.png" alt="SG-ERP" className="h-7 w-auto dark:hidden" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-wide-white.png" alt="SG-ERP" className="h-7 w-auto hidden dark:block" />
            </>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="sm:hidden text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {visibleItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsedView ? item.label : undefined}
                className={`flex items-center gap-3 rounded-lg border-l-2 py-2 text-sm font-mono font-medium uppercase tracking-wide transition-colors ${
                  collapsedView ? "justify-center px-2" : "px-3"
                } ${
                  active
                    ? "border-accent bg-accent/10 text-accent dark:bg-accent/15"
                    : "border-transparent text-black/70 dark:text-white/70 hover:bg-black/[0.03] dark:hover:bg-white/5"
                }`}
              >
                <Icon size={18} />
                {!collapsedView && item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-black/5 dark:border-white/10 space-y-3">
          {collapsedView ? (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
              className="w-full flex items-center justify-center rounded-lg border border-black/10 dark:border-white/10 p-2 hover:bg-black/[0.03] dark:hover:bg-white/5"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          ) : (
            <div className="flex items-center justify-between px-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{session.username}</div>
                <span
                  className={`inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${ROLE_BADGE_CLASS[session.role]}`}
                >
                  {ROLE_LABELS[session.role]}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
                title="Toggle dark mode"
                className="shrink-0 rounded-lg border border-black/10 dark:border-white/10 p-2 hover:bg-black/[0.03] dark:hover:bg-white/5"
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          )}
          <span className="btn-glow block w-full">
            <button
              type="button"
              onClick={handleLogout}
              title={collapsedView ? "Log out" : undefined}
              className={`w-full flex items-center btn-skew border border-black/10 dark:border-white/10 px-3 py-2 text-sm hover:bg-black/[0.03] dark:hover:bg-white/5 ${
                collapsedView ? "justify-center" : "gap-2"
              }`}
            >
              <LogOut size={16} />
              {!collapsedView && "Log out"}
            </button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen sm:flex">
      <RadarBackground blips={presentCount} />

      <div className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/10 bg-white dark:bg-neutral-900 sticky top-0 z-30">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="text-black/60 dark:text-white/60"
        >
          <Menu size={22} />
        </button>
        <span className="font-heading font-semibold text-sm uppercase tracking-wide">{activeItem?.label ?? "SG-ERP"}</span>
        <span className="w-[22px]" />
      </div>

      {mobileOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 max-w-[80vw] bg-white dark:bg-neutral-900 h-full shadow-lg">
            {renderSidebar(false)}
          </div>
        </div>
      )}

      <div
        className={`hidden sm:block relative shrink-0 transition-[width] duration-200 ${collapsed ? "w-16" : "w-60"}`}
      >
        <aside className="border-r border-black/5 dark:border-white/10 bg-white dark:bg-neutral-900 sticky top-0 h-screen overflow-y-auto">
          {renderSidebar(collapsed)}
        </aside>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute top-6 -right-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 text-black/50 dark:text-white/50 hover:text-accent hover:border-accent/40 card-glow"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <main className="flex-1 min-w-0 px-4 sm:px-8 py-6">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
