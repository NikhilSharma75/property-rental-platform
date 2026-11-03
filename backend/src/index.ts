import http from "http";
import app from "./app";
import { env } from "./config/env";
import { supabaseAdmin } from "./config/supabase";
import { initSocket } from "./realtime/socket";
import { getIO } from "./realtime/io";
import { startReminderJobs, stopReminderJobs } from "./jobs/reminders.job";

const server = http.createServer(app);
initSocket(server);

// Behind a proxy (Render, Nginx...): keep connections open longer than the proxy's idle timeout,
// otherwise requests sporadically fail with 502 errors.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

startReminderJobs();

server.listen(env.port, async () => {
  console.log(`Backend running on http://localhost:${env.port} [${env.nodeEnv}]`);
  console.log("Socket.IO ready for real-time messaging");

  const { error } = await supabaseAdmin.from("users").select("id", { head: true, count: "exact" }).limit(1);
  if (error) {
    console.error("❌ Supabase connection failed:", error.message);
  } else {
    console.log("✅ Supabase connected successfully");
  }
});

// ---- Graceful shutdown: let in-flight requests finish, stop jobs and sockets, then exit. ----
let shuttingDown = false;

function shutdown(reason: string, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${reason}: shutting down gracefully`);

  stopReminderJobs();

  // Safety net: never hang forever on a stuck connection.
  setTimeout(() => {
    console.error("Forced shutdown after 10 seconds");
    process.exit(1);
  }, 10_000).unref();

  try {
    getIO().close(); // disconnects sockets (and closes the HTTP server it is attached to)
  } catch {
    // Socket.IO was never initialised
  }
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(exitCode);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  shutdown("uncaughtException", 1); // the process state is unknown after this, so exit and let the host restart it
});