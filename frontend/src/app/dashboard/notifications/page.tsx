"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { relativeTime } from "@/lib/format";

export default function NotificationsPage() {
  const { user, loading, logout } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead, loading: nLoading } = useNotifications();

  if (loading || !user) return <main className="flex min-h-screen items-center justify-center"><p className="text-sm text-muted">Loading…</p></main>;

  return (
    <AppShell user={user} onLogout={logout} eyebrow="Account" title="Notifications">
      <PageHeader eyebrow="Inbox" title="Notifications"
        description={unreadCount ? `${unreadCount} unread` : "You're all caught up."}
        actions={unreadCount > 0 ? <Button variant="outline" size="sm" onClick={markAllRead}><CheckCheck className="h-4 w-4" /> Mark all read</Button> : undefined} />

      {!nLoading && notifications.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="No notifications" description="Application updates, rent reminders and maintenance news will show up here." />
      ) : (
        <ul className="glass card-edge divide-y divide-ink/8 overflow-hidden rounded-3xl">
          {notifications.map((n) => {
            const body = (
              <div className="flex items-start gap-3 px-5 py-4">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-ink/15" : "bg-primary"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.read_at ? "text-muted-2" : "font-semibold text-ink"}`}>{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted">{relativeTime(n.created_at)}</span>
              </div>
            );
            // Only same-site relative links are followed - a notification can never send the user off-site.
            const safeLink = n.link && n.link.startsWith("/") && !n.link.startsWith("//") ? n.link : null;
            return (
              <li key={n.id} className="transition-colors hover:bg-ink/3">
                {safeLink ? <Link href={safeLink} onClick={() => !n.read_at && markRead(n.id)}>{body}</Link>
                  : <button className="block w-full text-left" onClick={() => !n.read_at && markRead(n.id)}>{body}</button>}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
