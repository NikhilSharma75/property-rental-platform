import { Request, Response, NextFunction } from "express";
import { UserRole } from "../types";

// Usage: router.get('/landlord-only', requireAuth, requireRole('LANDLORD'), handler)
export function requireRole(...allowed: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated." });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to do that." });
    }
    next();
  };
}
