"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Activity, Bell, Building2, ClipboardList, KeyRound, Star, CreditCard, FileText, Flag, Heart, LayoutDashboard, LogOut,
  MessageSquare, ScrollText, Search, UserRound, Users, Wrench, X,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useNotifications } from "@/context/NotificationContext";

type NavItem = { label: string; href: string; icon: ReactNode; badge?: number };
type NavGroup = { label: string; items: NavItem[] };

const ic = "h-[18px] w-[18px]";

function navGroupsForRole(role: string, unread: number): NavGroup[] {
  if (role === "ADMIN") {
    return [
      {
        label: "Platform",
        items: [
          { label: "Overview", href: "/admin", icon: <Activity className={ic} /> },
          { label: "Users", href: "/admin/users", icon: <Users className={ic} /> },
          { label: "Landlords", href: "/admin/verifications", icon: <KeyRound className={ic} /> },
          { label: "Properties", href: "/admin/properties", icon: <Building2 className={ic} /> },
          { label: "Applications", href: "/admin/applications", icon: <FileText className={ic} /> },
          { label: "Reports", href: "/admin/reports", icon: <Flag className={ic} /> },
          { label: "Reviews", href: "/admin/reviews", icon: <Star className={ic} /> },
          { label: "Audit log", href: "/admin/audit", icon: <ClipboardList className={ic} /> },
        ],
      },
      {
        label: "Account",
        items: [
          { label: "Notifications", href: "/dashboard/notifications", icon: <Bell className={ic} />, badge: unread },
          { label: "Profile", href: "/dashboard/profile", icon: <UserRound className={ic} /> },
        ],
      },
    ];
  }

  const landlord = role === "LANDLORD";
  return [
    {
      label: "Workspace",
      items: [
        { label: "Overview", href: "/dashboard", icon: <LayoutDashboard className={ic} /> },
        landlord
          ? { label: "Properties", href: "/dashboard/properties", icon: <Building2 className={ic} /> }
          : { label: "Browse listings", href: "/properties", icon: <Search className={ic} /> },
        ...(landlord ? [] : [{ label: "Favorites", href: "/dashboard/favorites", icon: <Heart className={ic} /> }]),
        landlord
          ? { label: "Applications", href: "/landlord/applications", icon: <FileText className={ic} /> }
          : { label: "My applications", href: "/applications", icon: <FileText className={ic} /> },
        landlord
          ? { label: "Leases", href: "/landlord/leases", icon: <ScrollText className={ic} /> }
          : { label: "My leases", href: "/leases", icon: <ScrollText className={ic} /> },
      ],
    },
    {
      label: "Account",
      items: [
        { label: "Payments", href: "/dashboard/payments", icon: <CreditCard className={ic} /> },
        landlord
          ? { label: "Maintenance", href: "/landlord/maintenance", icon: <Wrench className={ic} /> }
          : { label: "Maintenance", href: "/maintenance", icon: <Wrench className={ic} /> },
        { label: "Messages", href: "/dashboard/messages", icon: <MessageSquare className={ic} /> },
        { label: "Notifications", href: "/dashboard/notifications", icon: <Bell className={ic} />, badge: unread },
        { label: "Profile", href: "/dashboard/profile", icon: <UserRound className={ic} /> },
      ],
    },
  ];
}

function isActive(pathname: string, href: string) {
  // Overview roots must match exactly, otherwise they'd light up for every child route.
  if (href === "/dashboard" || href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({
  role, onLogout, onNavigate, onClose,
}: {
  role: string;
  onLogout: () => void | Promise<void>;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { unreadCount } = useNotifications();
  const groups = navGroupsForRole(role, unreadCount);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div className="glass-strong flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-ink/8 px-5 py-5">
          <Logo href={role === "ADMIN" ? "/admin" : "/dashboard"} />
          {onClose && (
            <button onClick={onClose} aria-label="Close menu"
              className="rounded-xl p-1.5 text-muted-2 transition-colors hover:bg-ink/5 hover:text-ink">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted/70">{group.label}</p>
              <div className="mt-2 space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                        active
                          ? "bg-gradient-to-r from-primary/20 to-primary/5 font-medium text-primary shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--c-primary)_25%,transparent)]"
                          : "text-muted-2 hover:bg-ink/5 hover:text-ink"
                      }`}
                    >
                      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />}
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        active ? "bg-primary/15 text-primary" : "bg-ink/5 text-muted-2 group-hover:text-ink"
                      }`}>
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {!!item.badge && item.badge > 0 && (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-ink/8 p-3">
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted-2 transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-ink/5">
              <LogOut className="h-4 w-4" />
            </span>
            Log out
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Log out of RentEase?"
        description="You'll need to sign in again to access your dashboard, applications, and saved properties."
        confirmLabel="Log out"
        cancelLabel="Stay signed in"
        icon={<LogOut className="h-5 w-5" />}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => { await onLogout(); setConfirmOpen(false); }}
      />
    </>
  );
}
