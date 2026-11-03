import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = verifyAccessToken(header.slice("Bearer ".length));
    } catch {
      // invalid/expired token on a public route just means "not logged in"
    }
  }
  next();
}