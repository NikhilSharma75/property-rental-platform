import { LIST_HARD_CAP } from "../config/limits";
import { supabaseAdmin } from "../config/supabase";
import { Conversation, Message } from "../types";
import { getIO } from "../realtime/io";
import * as inApp from "./in-app-notification.service";

export async function getConversationOrThrow(id: string): Promise<Conversation> {
  const { data, error } = await supabaseAdmin.from("conversations").select("*").eq("id", id).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  if (!data) throw Object.assign(new Error("Conversation not found."), { statusCode: 404 });
  return data as Conversation;
}

export async function assertParticipant(conversationId: string, userId: string): Promise<Conversation> {
  const conversation = await getConversationOrThrow(conversationId);
  if (conversation.tenant_id !== userId && conversation.landlord_id !== userId) {
    throw Object.assign(new Error("You are not part of this conversation."), { statusCode: 403 });
  }
  return conversation;
}

/**
 * Finds the conversation for this tenant/landlord/property, creating it (and
 * seeding both participants) the first time. Called when an application is
 * approved, so messaging opens up automatically for both sides.
 */
export async function getOrCreateConversation(
  tenantId: string,
  landlordId: string,
  propertyId: string,
  applicationId?: string
): Promise<Conversation> {
  const { data: existing } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("landlord_id", landlordId)
    .eq("property_id", propertyId)
    .limit(1)
    .maybeSingle();

  if (existing) return existing as Conversation;

  const { data: created, error } = await supabaseAdmin
    .from("conversations")
    .insert({ tenant_id: tenantId, landlord_id: landlordId, property_id: propertyId, application_id: applicationId ?? null })
    .select()
    .single();

  if (error || !created) throw Object.assign(new Error("Failed to create conversation."), { statusCode: 500 });

  await supabaseAdmin.from("conversation_participants").insert([
    { conversation_id: created.id, user_id: tenantId },
    { conversation_id: created.id, user_id: landlordId },
  ]);

  // Notify both sides live, in case either has the Messages page open already.
  try {
    getIO().to(`user:${tenantId}`).to(`user:${landlordId}`).emit("conversation_created", created);
  } catch {
    // Socket.IO isn't initialized (e.g. a script or test run) -- fine, REST will pick it up on next load.
  }

  return created as Conversation;
}

export async function listConversations(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select(
      "*, properties(title, city), tenant:users!conversations_tenant_id_fkey(full_name, email, profile_image_url), landlord:users!conversations_landlord_id_fkey(full_name, email, profile_image_url)"
    )
    .or(`tenant_id.eq.${userId},landlord_id.eq.${userId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(LIST_HARD_CAP);

  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });

  const conversations = data ?? [];
  // `.in("conversation_id", [])` produces an invalid PostgREST filter, so skip the query
  // entirely for a user who has no conversations yet.
  if (conversations.length === 0) return [];

  const { data: participantRows } = await supabaseAdmin
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId)
    .in("conversation_id", conversations.map((c: any) => c.id));

  const lastReadByConversation = new Map((participantRows ?? []).map((r) => [r.conversation_id, r.last_read_at]));

  return Promise.all(
    conversations.map(async (c: any) => {
      const lastRead = lastReadByConversation.get(c.id) ?? "1970-01-01T00:00:00Z";
      const { count } = await supabaseAdmin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .neq("sender_id", userId)
        .gt("created_at", lastRead);
      return { ...c, unread_count: count ?? 0 };
    })
  );
}

export async function listMessages(conversationId: string, userId: string, before?: string): Promise<Message[]> {
  await assertParticipant(conversationId, userId);
  let query = supabaseAdmin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 });
  return ((data ?? []) as Message[]).reverse(); // oldest first, for rendering top-to-bottom
}

export async function sendMessage(conversationId: string, senderId: string, body: string): Promise<Message> {
  const trimmed = body.trim();
  if (!trimmed) throw Object.assign(new Error("Message cannot be empty."), { statusCode: 400 });
  if (trimmed.length > 4000) throw Object.assign(new Error("Message is too long."), { statusCode: 400 });

  await assertParticipant(conversationId, senderId);

  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body: trimmed })
    .select()
    .single();
  if (error || !data) throw Object.assign(new Error("Failed to send message."), { statusCode: 500 });

  await supabaseAdmin
    .from("conversations")
    .update({ last_message_at: data.created_at, last_message_preview: trimmed.slice(0, 140), last_sender_id: senderId })
    .eq("id", conversationId);

  // Sending a message counts as having read up to that point yourself.
  await supabaseAdmin
    .from("conversation_participants")
    .update({ last_read_at: data.created_at })
    .eq("conversation_id", conversationId)
    .eq("user_id", senderId);

  // Notify the recipient in-app. The live socket broadcast already covers
  // anyone with the conversation open; this covers the bell for everyone else.
  try {
    const conversation = await getConversationOrThrow(conversationId);
    const recipientId = conversation.tenant_id === senderId ? conversation.landlord_id : conversation.tenant_id;
    const [sender, property] = await Promise.all([
      supabaseAdmin.from("users").select("full_name, email").eq("id", senderId).maybeSingle(),
      conversation.property_id
        ? supabaseAdmin.from("properties").select("title").eq("id", conversation.property_id).maybeSingle()
        : Promise.resolve({ data: null as { title: string } | null }),
    ]);
    const senderName = sender.data?.full_name ?? sender.data?.email ?? "New message";
    const preview = property.data?.title ? `${property.data.title}: ${trimmed.slice(0, 100)}` : trimmed.slice(0, 100);
    await inApp.notifyUser(recipientId, "MESSAGE_RECEIVED", senderName, preview, "/dashboard/messages");
  } catch (err) {
    console.error("Failed to create message notification:", (err as Error).message);
  }


  return data as Message;
}

export async function markRead(conversationId: string, userId: string): Promise<string> {
  await assertParticipant(conversationId, userId);
  const readAt = new Date().toISOString();
  await supabaseAdmin
    .from("conversation_participants")
    .update({ last_read_at: readAt })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  return readAt;
}

export async function getUnreadCountForConversation(conversationId: string, userId: string): Promise<number> {
  const { data: participant } = await supabaseAdmin
    .from("conversation_participants")
    .select("last_read_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  const lastRead = participant?.last_read_at ?? "1970-01-01T00:00:00Z";
  const { count } = await supabaseAdmin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .gt("created_at", lastRead);
  return count ?? 0;
}