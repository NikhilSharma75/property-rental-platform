"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import type { AppNotification } from "@/lib/api";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const TYPE_DOT: Record<string, string> = {
  APPLICATION_SUBMITTED: "bg-primary",
  APPLICATION_APPROVED: "bg-[#10b981]",
  APPLICATION_REJECTED: "bg-[#ef4444]",
  LEASE_READY: "bg-gold",
  LEASE_ACTIVATED: "bg-[#10b981]",
  LEASE_EXPIRING: "bg-gold",
  INVOICE_CREATED: "bg-primary",
  RENT_REMINDER: "bg-gold",
  PAYMENT_SUCCEEDED: "bg-[#10b981]",
  PAYMENT_FAILED: "bg-[#ef4444]",
  MAINTENANCE_CREATED: "bg-primary",
  MAINTENANCE_STATUS_UPDATED: "bg-primary",
  MESSAGE_RECEIVED: "bg-primary",
  SAVED_SEARCH_MATCHES: "bg-gold",
};

export function NotificationBell() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  function handleClick(n: AppNotification) {
    if (!n.read_at) markRead(n.id);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        className="relative rounded-full p-2 text-muted-2 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-ink/10 glass-strong shadow-xl">
          <div className="flex items-center justify-between border-b border-ink/8 px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-ink/5" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">You&apos;re all caught up.</p>
            ) : (
              notifications.map((n) => {
                const unread = !n.read_at;
                const body = (
                  <div className={`flex gap-2.5 px-4 py-3 ${unread ? "bg-primary-soft/40" : ""}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? TYPE_DOT[n.type] ?? "bg-primary" : "bg-transparent"}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${unread ? "font-semibold text-ink" : "font-medium text-muted-2"}`}>{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>}
                      <p className="mt-1 text-[11px] text-muted">{relativeTime(n.created_at)}</p>
                    </div>
                  </div>
                );
                return n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? (
                  <Link key={n.id} href={n.link} onClick={() => handleClick(n)} className="block border-b border-ink/6 last:border-0 hover:bg-ink/5">
                    {body}
                  </Link>
                ) : (
                  <button key={n.id} onClick={() => handleClick(n)} className="block w-full border-b border-ink/6 text-left last:border-0 hover:bg-ink/5">
                    {body}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
