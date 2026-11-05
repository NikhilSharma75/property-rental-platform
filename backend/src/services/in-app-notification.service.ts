import { supabaseAdmin } from "../config/supabase";
import { getIO } from "../realtime/io";

export type NotificationType =
  | "APPLICATION_SUBMITTED" | "APPLICATION_APPROVED" | "APPLICATION_REJECTED"
  | "LEASE_READY" | "LEASE_ACTIVATED" | "LEASE_EXPIRING"
  | "INVOICE_CREATED" | "RENT_REMINDER" | "PAYMENT_SUCCEEDED" | "PAYMENT_FAILED"
  | "MAINTENANCE_CREATED" | "MAINTENANCE_STATUS_UPDATED"
  | "MESSAGE_RECEIVED"
  | "VERIFICATION_APPROVED" | "VERIFICATION_REJECTED"
  | "REPORT_UPDATED"
  | "APPROVAL_EXPIRED" | "RESERVATION_RELEASED" | "LEASE_ENDED"| "SAVED_SEARCH_MATCHES"; 



export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export async function notifyUser(userId: string, type: NotificationType, title: string, body?: string, link?: string) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert({ user_id: userId, type, title, body: body ?? null, link: link ?? null })
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to create in-app notification:", error?.message);
    return;
  }

  try {
    const { count } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    getIO().to(`user:${userId}`).emit("notification", { notification: data, unreadCount: count ?? 0 });
  } catch {
    // Socket.IO isn't initialized (e.g. a script run) -- the row is still saved for the next page load.
  }
}



export async function list(userId: string, limit = 30) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  return (data ?? []) as AppNotification[];
}

export async function unreadCount(userId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

export async function markRead(userId: string, id: string) {
  await supabaseAdmin.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
}

export async function markAllRead(userId: string) {
  await supabaseAdmin.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
}