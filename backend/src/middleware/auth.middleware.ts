import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { getLiveStatus } from "../services/user-status.service";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or malformed access token." });
  }

  let payload;
  try {
    payload = verifyAccessToken(header.slice("Bearer ".length));
  } catch {
    return res.status(401).json({ message: "Access token is invalid or expired." });
  }

  try {
    const live = await getLiveStatus(payload.sub);
    if (!live) return res.status(401).json({ message: "Account no longer exists." });
    if (!live.active) return res.status(403).json({ message: "This account has been suspended." });
    // Trust the DB role over the (up to 15 min old) token role.
    req.user = { ...payload, role: live.role as typeof payload.role };
    next();
  } catch (err) {
    next(err);
  }
}
