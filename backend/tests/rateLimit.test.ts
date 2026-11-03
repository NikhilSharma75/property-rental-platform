import { describe, it, expect, vi, afterEach } from "vitest";
import type { Request, Response } from "express";
import { rateLimit } from "../src/middleware/rateLimit.middleware";

function run(limiter: ReturnType<typeof rateLimit>, ip = "1.1.1.1") {
  const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
  const next = vi.fn();
  limiter({ ip } as Request, res, next);
  return { res, next };
}

describe("rateLimit", () => {
  afterEach(() => vi.useRealTimers());

  it("allows up to `max` requests then answers 429 with Retry-After", () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2, keyPrefix: "t1" });
    expect(run(limiter).next).toHaveBeenCalled();
    expect(run(limiter).next).toHaveBeenCalled();
    const blocked = run(limiter);
    expect(blocked.next).not.toHaveBeenCalled();
    expect(blocked.res.status).toHaveBeenCalledWith(429);
    expect(blocked.res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
  });

  it("tracks each IP separately", () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1, keyPrefix: "t2" });
    run(limiter, "1.1.1.1");
    expect(run(limiter, "2.2.2.2").next).toHaveBeenCalled();
  });

  it("can bucket by a custom key (e.g. user id) instead of the IP", () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1, keyPrefix: "t4", key: (req) => (req as unknown as { user: { sub: string } }).user.sub });
    const hit = (sub: string, ip: string) => {
      const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
      const next = vi.fn();
      limiter({ ip, user: { sub } } as unknown as Request, res, next);
      return next;
    };
    expect(hit("user-a", "9.9.9.9")).toHaveBeenCalled();
    expect(hit("user-a", "8.8.8.8")).not.toHaveBeenCalled(); // new IP, same user: still limited
    expect(hit("user-b", "9.9.9.9")).toHaveBeenCalled();      // same IP, other user: allowed
  });

  it("lets requests through again after the window passes", () => {
    vi.useFakeTimers();
    const limiter = rateLimit({ windowMs: 1_000, max: 1, keyPrefix: "t3" });
    run(limiter);
    expect(run(limiter).next).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_500);
    expect(run(limiter).next).toHaveBeenCalled();
  });
});
