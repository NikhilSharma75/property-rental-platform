import { Request, Response, NextFunction } from "express";

/**
 * Minimal fixed-window limiter (no extra dependency). Per-process memory: fine for one instance,
 * swap for `rate-limit-redis` before running several replicas. Needs `app.set("trust proxy", 1)` behind a proxy.
 * The number of tracked keys is capped (default 10,000): under a flood of distinct clients the oldest
 * counters are dropped instead of letting memory grow.
 */
export function rateLimit(opts: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  /** Custom bucket key. Use `(req) => req.user?.sub` on authenticated routes so users behind one NAT don't share a limit. */
  key?: (req: Request) => string | undefined;
  /** Maximum number of tracked keys. */
  maxKeys?: number;
}) {
  const maxKeys = opts.maxKeys ?? 10_000;
  const hits = new Map<string, { count: number; reset: number }>();

  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, opts.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${opts.keyPrefix}:${opts.key?.(req) ?? req.ip}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.reset <= now) {
      if (!entry && hits.size >= maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      hits.set(key, { count: 1, reset: now + opts.windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > opts.max) {
      res.setHeader("Retry-After", Math.ceil((entry.reset - now) / 1000).toString());
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    next();
  };
}