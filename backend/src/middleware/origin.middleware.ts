import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

/**
 * Cookie-authenticated POSTs (/auth/refresh, /auth/logout) must come from our own frontend.
 * SameSite=None (needed cross-domain in production) otherwise lets any site trigger them.
 * Browsers always send Origin on cross-site POSTs; non-browser clients (no Origin) are not CSRF-able.
 */
export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && origin !== env.frontendUrl) {
    return res.status(403).json({ message: "Cross-origin request blocked." });
  }
  next();
}
