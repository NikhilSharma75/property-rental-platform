import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import authRoutes from "./routes/auth.routes";
import profileRoutes from "./routes/profile.routes";
import { errorHandler } from "./middleware/error.middleware";
import propertyRoutes from "./routes/property.routes";
import publicPropertyRoutes from "./routes/public-property.routes";
import favoriteRoutes from "./routes/favorite.routes";
import applicationRoutes from "./routes/application.routes";
import documentRoutes from "./routes/document.routes";
import leaseRoutes from "./routes/lease.routes";
import maintenanceRoutes from "./routes/maintenance.routes";
import paymentRoutes from "./routes/payment.routes";
import { handleWebhook } from "./controllers/payment.controller";
import conversationRoutes from "./routes/conversation.routes";
import notificationRoutes from "./routes/notification.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import adminRoutes from "./routes/admin.routes";
import savedSearchRoutes from "./routes/saved-search.routes";
import { reportRouter, reviewRouter } from "./routes/report.routes";



const app = express();

// Behind a proxy / load balancer (Render, Railway, Nginx...) so req.ip and rate limits see the real client IP.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet());
app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true, // allows cookies to be sent/received cross-origin
  })
);

// Stripe's webhook needs the raw request body to verify its signature, so
// this route is registered BEFORE express.json() parses the body into an
// object. It has no auth middleware -- Stripe authenticates itself via the
// signature instead of a bearer token.
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), handleWebhook);

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", env: env.nodeEnv });
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/properties", propertyRoutes);

app.use("/api/public/properties", publicPropertyRoutes);
app.use("/api/favorites", favoriteRoutes);

app.use("/api/applications", applicationRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/leases", leaseRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/saved-searches", savedSearchRoutes);

// Unknown routes first, then the error handler (error middleware must be registered last).
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found." });
});

app.use(errorHandler);

export default app;