"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, MessageCircle, Search, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { conversationApi, Conversation, Message } from "@/lib/api";
import { connectSocket,  getSocket } from "@/lib/socket";
import { AppShell } from "@/components/layout/AppShell";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function timeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function initials(name: string | null | undefined, email: string | undefined): string {
  const src = (name ?? email ?? "?").trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-primary-soft text-primary",
  "bg-gold/15 text-gold-ink",
  "bg-emerald-100 text-emerald-800",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
];

function avatarColor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function Avatar({ name, email, size = 40 }: { name: string | null | undefined; email: string | undefined; size?: number }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${avatarColor(email ?? name ?? "?")}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials(name, email)}
    </span>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-1" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
    </span>
  );
}

export default function MessagesPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [connected, setConnected] = useState(false);
  const [query, setQuery] = useState("");

  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef<string | null>(null);
  const otherTypingClearTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  useEffect(() => {
    if (authLoading || !user) return;
    const currentUserId = user.id;
    const socket = connectSocket();

    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs UI state with the live socket connection
    setConnected(socket.connected);

    conversationApi
      .list()
      .then(({ conversations }) => setConversations(conversations))
      .catch((err) => {
        setError(err.message ?? "Failed to load conversations.");
        setConversations([]);
      });

    function onConnect() {
      setConnected(true);
    }
    function onDisconnect() {
      setConnected(false);
    }

    function onConversationUpdated(payload: { conversationId: string; lastMessage: Message; unreadCount: number }) {
      setConversations((prev) => {
        if (!prev) return prev;
        const idx = prev.findIndex((c) => c.id === payload.conversationId);
        if (idx === -1) return prev;
        const updated = {
          ...prev[idx],
          last_message_at: payload.lastMessage.created_at,
          last_message_preview: payload.lastMessage.body.slice(0, 140),
          last_sender_id: payload.lastMessage.sender_id,
          unread_count: activeIdRef.current === payload.conversationId ? 0 : payload.unreadCount,
        };
        return [updated, ...prev.filter((c) => c.id !== payload.conversationId)];
      });













      

      if (activeIdRef.current === payload.conversationId) {
        setMessages((prev) => (prev.some((m) => m.id === payload.lastMessage.id) ? prev : [...prev, payload.lastMessage]));
        if (payload.lastMessage.sender_id !== currentUserId) {
          socket.emit("mark_read", payload.conversationId);
        }
      }
    }



    

    function onNewMessage(message: Message) {
      if (activeIdRef.current === message.conversation_id) {
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      }
    }

    function onConversationCreated(conversation: Conversation) {
      setConversations((prev) => {
        if (!prev) return [conversation];
        if (prev.some((c) => c.id === conversation.id)) return prev;
        return [{ ...conversation, unread_count: 0 }, ...prev];
      });
    }

    function onTyping(payload: { conversationId: string; userId: string; isTyping: boolean }) {
  if (payload.conversationId !== activeIdRef.current || payload.userId === currentUserId) return;
  setOtherTyping(payload.isTyping);
  
  if (otherTypingClearTimeout.current) clearTimeout(otherTypingClearTimeout.current);
  if (payload.isTyping) {
    otherTypingClearTimeout.current = setTimeout(() => setOtherTyping(false), 4000);
  }
}

    function onReadReceipt(payload: { conversationId: string; userId: string; readAt: string }) {
      if (payload.conversationId === activeIdRef.current && payload.userId !== currentUserId) {
        setOtherLastReadAt(payload.readAt);
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("conversation_updated", onConversationUpdated);
    socket.on("new_message", onNewMessage);
    socket.on("conversation_created", onConversationCreated);
    socket.on("typing", onTyping);
    socket.on("read_receipt", onReadReceipt);

   return () => {
  if (otherTypingClearTimeout.current) clearTimeout(otherTypingClearTimeout.current);
  socket.off("connect", onConnect);
  socket.off("disconnect", onDisconnect);
  socket.off("conversation_updated", onConversationUpdated);
  socket.off("new_message", onNewMessage);
  socket.off("conversation_created", onConversationCreated);
  socket.off("typing", onTyping);
  socket.off("read_receipt", onReadReceipt);
};

  }, [authLoading, user]);

  useEffect(() => {
    if (!activeId) return;
    const socket = getSocket();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs UI state with the live socket connection
    setLoadingMessages(true);
    setMessages([]);
    setOtherTyping(false);
    setOtherLastReadAt(null);

    socket.emit("join_conversation", activeId);

    conversationApi
      .listMessages(activeId)
      .then(({ messages }) => setMessages(messages))
      .catch((err) => setError(err.message ?? "Failed to load messages."))
      .finally(() => setLoadingMessages(false));

    socket.emit("mark_read", activeId);
    setConversations((prev) => (prev ? prev.map((c) => (c.id === activeId ? { ...c, unread_count: 0 } : c)) : prev));

    return () => {
      socket.emit("leave_conversation", activeId);
    };
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherTyping]);

  function handleDraftChange(value: string) {
    setDraft(value);
    if (!activeId) return;
    const socket = getSocket();
    socket.emit("typing", { conversationId: activeId, isTyping: true });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("typing", { conversationId: activeId, isTyping: false });
    }, 1500);
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    setError(null);
    const socket = getSocket();
    socket.emit("send_message", { conversationId: activeId, body }, (result: { ok: boolean; error?: string }) => {
      setSending(false);
      if (!result.ok) {
        setError(result.error ?? "Failed to send message.");
        return;
      }
      setDraft("");
      socket.emit("typing", { conversationId: activeId, isTyping: false });
      inputRef.current?.focus();
    });
  }

  const filteredConversations = useMemo(() => {
    if (!conversations) return null;
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const other = user?.role === "LANDLORD" ? c.tenant : c.landlord;
      const hay = [other?.full_name, other?.email, c.properties?.title].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, query, user?.role]);

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-ink">
        <p className="text-sm tracking-wide text-muted">Loading...</p>
      </main>
    );
  }

  const activeConversation = conversations?.find((c) => c.id === activeId) ?? null;
  const otherParty = activeConversation && (user.role === "LANDLORD" ? activeConversation.tenant : activeConversation.landlord);
  const otherName = otherParty?.full_name || otherParty?.email || "Conversation";

  return (
    <AppShell user={user} onLogout={logout} eyebrow={user.role === "LANDLORD" ? "For landlords" : "For tenants"} title="Messages">
      <div className={activeId ? "hidden sm:block" : ""}>
        <h1 className="text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] text-ink sm:text-[2.35rem]">Messages</h1>
        <p className="mt-2 max-w-lg text-[15px] text-muted-2">
          {user.role === "LANDLORD"
            ? "Message tenants directly once you've approved their application."
            : "Message your landlord directly once your application is approved."}
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6 flex h-[calc(100dvh-220px)] min-h-[480px] overflow-hidden rounded-xl border border-ink/8 glass shadow-sm sm:mt-8 sm:h-[72vh]">
        {/* Conversation list */}
        <aside
          className={`${activeId ? "hidden sm:flex" : "flex"} w-full shrink-0 flex-col sm:max-w-[300px] sm:border-r sm:border-ink/8`}
        >
          <div className="shrink-0 border-b border-ink/8 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
                className="w-full rounded-full border border-ink/12 bg-canvas py-2 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-muted focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations === null ? (
              <div className="space-y-2 p-3" aria-busy="true" aria-label="Loading conversations">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex animate-pulse items-center gap-3 rounded-lg p-2">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-ink/8" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-28 rounded bg-ink/8" />
                      <div className="h-3 w-40 rounded bg-ink/6" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations!.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas">
                  <MessageCircle className="h-6 w-6 text-muted" aria-hidden="true" />
                </span>
                <p className="text-sm text-muted">
                  {query
                    ? "No conversations match your search."
                    : user.role === "TENANT"
                    ? "Once your application is approved, you'll be able to message your landlord here."
                    : "Once you approve a tenant's application, you'll be able to message them here."}
                </p>
              </div>
            ) : (
              filteredConversations!.map((c) => {
                const other = user.role === "LANDLORD" ? c.tenant : c.landlord;
                const name = other?.full_name || other?.email || "Conversation";
                const active = c.id === activeId;
                const mine = c.last_sender_id === user.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`flex w-full items-center gap-3 border-b border-ink/6 px-3 py-3 text-left transition-colors ${focusRing} ${
                      active ? "bg-primary-soft" : "hover:bg-ink/5"
                    }`}
                  >
                    <Avatar name={other?.full_name} email={other?.email} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm font-semibold ${active ? "text-primary" : "text-ink"}`}>{name}</span>
                        {c.last_message_at && (
                          <span className="shrink-0 text-[11px] text-muted">{relativeTime(c.last_message_at)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-muted">
                          {c.last_message_preview ? (
                            <>
                              {mine && <span className="text-muted-2">You: </span>}
                              {c.last_message_preview}
                            </>
                          ) : (
                            c.properties?.title ?? "Property"
                          )}
                        </span>
                        {c.unread_count > 0 && (
                          <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-semibold text-white">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Thread */}
        <div className={`${activeId ? "flex" : "hidden sm:flex"} min-w-0 flex-1 flex-col bg-canvas/40`}>
          {!activeConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-canvas">
                <MessageCircle className="h-7 w-7 text-muted" aria-hidden="true" />
              </span>
              <p className="text-sm text-muted">Select a conversation to start messaging.</p>
            </div>
          ) : (
            <>
              <header className="flex shrink-0 items-center gap-3 border-b border-ink/8 glass px-4 py-3">
                <button
                  onClick={() => setActiveId(null)}
                  aria-label="Back to conversations"
                  className={`-ml-1 rounded-full p-1.5 text-muted-2 hover:bg-ink/5 sm:hidden ${focusRing}`}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Avatar name={otherParty?.full_name} email={otherParty?.email} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{otherName}</p>
                  <p className="truncate text-xs text-muted">{activeConversation.properties?.title ?? "Property"}</p>
                </div>
                <span
                  title={connected ? "Connected" : "Reconnecting..."}
                  className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-[#10b981]" : "animate-pulse bg-muted"}`}
                  aria-hidden="true"
                />
              </header>

              <div className="flex-1 overflow-y-auto px-4 py-4">
                               {loadingMessages ? (
                  <p className="text-center text-sm text-muted">Loading messages...</p>
                ) : (
                  <div className="space-y-1">
                    {messages.length === 0 && !otherTyping && (
                      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                        <Avatar name={otherParty?.full_name} email={otherParty?.email} size={48} />
                        <p className="mt-1 text-sm font-medium text-ink">{otherName}</p>
                        <p className="text-xs text-muted">No messages yet — say hello.</p>
                      </div>
                    )}

                    {messages.map((m, i) => {
                      const mine = m.sender_id === user.id;
                      const prev = messages[i - 1];
                      const showDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
                      const isRead = mine && !!otherLastReadAt && new Date(m.created_at).getTime() <= new Date(otherLastReadAt).getTime();
                      return (
                        <div key={m.id}>
                          {showDay && (
                            <p className="my-4 text-center text-xs font-medium uppercase tracking-wide text-muted">{dayLabel(m.created_at)}</p>
                          )}
                          <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[70%] ${
                                mine ? "rounded-br-md bg-btn text-white" : "rounded-bl-md glass text-ink"
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words">{m.body}</p>
                              <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-white/60" : "text-muted"}`}>
                                {timeShort(m.created_at)}
                                {mine && (isRead ? <CheckCheck className="h-3 w-3 text-blue-300" /> : <Check className="h-3 w-3" />)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {otherTyping && (
                      <div className="flex justify-start">
                        <div className="rounded-2xl rounded-bl-md glass px-3 py-2 shadow-sm">
                          <TypingDots />
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              <form onSubmit={handleSend} className="flex shrink-0 items-center gap-2 border-t border-ink/8 glass p-3">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  placeholder="Write a message..."
                  autoComplete="off"
                  className="flex-1 rounded-full border border-ink/15 bg-canvas px-4 py-2.5 text-sm text-ink outline-none focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20"
                />
                
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  aria-label="Send message"
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-btn text-white transition-transform hover:bg-btn-soft disabled:opacity-40 disabled:hover:scale-100 enabled:active:scale-95 ${focusRing}`}
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}   

        </div>
      </div>
    </AppShell>

  );
}

