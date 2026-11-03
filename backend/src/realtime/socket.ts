import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { verifyAccessToken } from "../utils/jwt";
import { env } from "../config/env";
import { setIO } from "./io";
import * as messagingService from "../services/messaging.service";

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.frontendUrl, credentials: true },
  });

  // Every socket must present the same JWT used for REST requests, as
  // `auth.token` on connection -- there is no separate login for sockets.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing access token."));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("Invalid or expired access token."));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    // A personal room lets us push things to a user (new conversation,
    // unread counts) regardless of which conversation they have open.
    socket.join(`user:${userId}`);

    socket.on("join_conversation", async (conversationId: string, ack?: (ok: boolean) => void) => {
      try {
        await messagingService.assertParticipant(conversationId, userId);
        socket.join(`conversation:${conversationId}`);
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });

    socket.on("leave_conversation", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on(
      "send_message",
      async (
        payload: { conversationId: string; body: string },
        ack?: (result: { ok: true; message: any } | { ok: false; error: string }) => void
      ) => {
        try {
          const message = await messagingService.sendMessage(payload.conversationId, userId, payload.body);
          const conversation = await messagingService.getConversationOrThrow(payload.conversationId);
          const otherUserId = conversation.tenant_id === userId ? conversation.landlord_id : conversation.tenant_id;

          io.to(`conversation:${payload.conversationId}`).emit("new_message", message);
          // The recipient may not have this conversation open, so also
          // notify their personal room for an unread badge / toast.
          const unread = await messagingService.getUnreadCountForConversation(payload.conversationId, otherUserId);
          io.to(`user:${otherUserId}`).emit("conversation_updated", {
            conversationId: payload.conversationId,
            lastMessage: message,
            unreadCount: unread,
          });

          ack?.({ ok: true, message });
        } catch (err) {
          ack?.({ ok: false, error: (err as Error).message });
        }
      }
    );

    socket.on("typing", async (payload: { conversationId: string; isTyping: boolean }) => {
      try {
        await messagingService.assertParticipant(payload.conversationId, userId);
        socket.to(`conversation:${payload.conversationId}`).emit("typing", {
          conversationId: payload.conversationId,
          userId,
          isTyping: payload.isTyping,
        });
      } catch {
        // not a participant in this conversation -- ignore silently
      }
    });

    socket.on("mark_read", async (conversationId: string, ack?: (ok: boolean) => void) => {
      try {
        const readAt = await messagingService.markRead(conversationId, userId);
        io.to(`conversation:${conversationId}`).emit("read_receipt", { conversationId, userId, readAt });
        ack?.(true);
      } catch {
        ack?.(false);
      }
    });
  });

  setIO(io);
  return io;
}