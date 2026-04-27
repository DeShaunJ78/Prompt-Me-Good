import type { Request, Response, NextFunction } from "express";

export function getClientKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function makeRateLimiter(opts: { windowMs: number; max: number; label: string }) {
  const hits = new Map<string, number[]>();
  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const key = getClientKey(req);
    const now = Date.now();
    const cutoff = now - opts.windowMs;
    const arr = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (arr.length >= opts.max) {
      res.status(429).json({
        success: false,
        ok: false,
        error: opts.label === "run"
          ? "Too many AI executions. Please wait before trying again."
          : opts.label === "generate"
          ? "Too many prompt generations. Please wait before trying again."
          : "Too many requests. Please wait a moment and try again.",
      });
      return;
    }
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        if (v.length === 0 || v[v.length - 1]! < cutoff) hits.delete(k);
      }
    }
    next();
  };
}

const HOUR_MS = 60 * 60 * 1000;
export const generateLimiter = makeRateLimiter({ windowMs: HOUR_MS, max: 20, label: "generate" });
export const runLimiter = makeRateLimiter({ windowMs: HOUR_MS, max: 5, label: "run" });
export const rateLimit = makeRateLimiter({ windowMs: 60 * 1000, max: 10, label: "general" });
