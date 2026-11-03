"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { notificationApi, AppNotification } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  refresh: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const { notifications, unreadCount } = await notificationApi.list();
      setNotifications(notifications);
      setUnreadCount(unreadCount);
    } catch {
      // leave previous state on a transient failure
    } finally {
      setLoading(false);
    }
  }



  useEffect(() => {
    if (authLoading || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets state when the user logs out
      setNotifications([]);
      setUnreadCount(0);
      disconnectSocket();
      return;
    }

    const socket = connectSocket();
    refresh();

    function onNotification(payload: { notification: AppNotification; unreadCount: number }) {
      setNotifications((prev) => [payload.notification, ...prev].slice(0, 30));
      setUnreadCount(payload.unreadCount);
    }

    

    socket.on("notification", onNotification);
    return () => {
      socket.off("notification", onNotification);
      // The socket itself is NOT disconnected here -- the Messages page
      // shares this same connection for conversation rooms.
    };
  }, [authLoading, user]);

    function markRead(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
    notificationApi.markRead(id).catch(() => refresh());
  }

  

   function markAllRead() {
    setNotifications([]);
    setUnreadCount(0);
    notificationApi.markAllRead().catch(() => refresh());
  }



  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, markRead, markAllRead, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}



export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}