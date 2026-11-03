"use client";

import { io, Socket } from "socket.io-client";
import { api, getAccessToken, setAccessToken } from "./api";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5000";

let socket: Socket | null = null;

/**
 * Returns a shared Socket.IO connection, creating it on first use. `auth` is
 * a function so the token is read fresh on every (re)connect attempt --
 * a token refresh elsewhere in the app is picked up automatically.
 */
export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    autoConnect: false,
    auth: (cb) => cb({ token: getAccessToken() }),
    withCredentials: true,
  });




  // Access tokens expire (15 min by default). If a connect attempt fails
  // because of that, refresh it and retry once, rather than leaving the
  // socket dead until the user does something that triggers a REST refresh.
  socket.on("connect_error", async (err) => {
    if (!err.message?.toLowerCase().includes("token")) return;
    try {
      const refreshed = await api.refresh();
      setAccessToken(refreshed.accessToken);
      socket?.connect();
    } catch {
      // Refresh failed too -- leave it disconnected; normal auth redirects will handle it.
    }
  });

  return socket;
}




export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}


export function disconnectSocket(): void {
  socket?.disconnect();
}