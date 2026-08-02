/**
 * Fixed-window per-key request limiter.
 *
 * In-memory and therefore per-process, which is exactly this deployment (one
 * Node container, one SQLite file — see docker-compose.yml). Running more than
 * one app instance would give each its own counters and multiply the effective
 * limit; that setup needs a shared store (Redis) or the limit enforced at
 * nginx instead.
 *
 * A fixed window lets through up to 2x the limit across a window boundary. For
 * blocking order spam and password guessing that is irrelevant, and it costs
 * one integer per key instead of a timestamp list per key.
 */

type Window = { count: number; resetAt: number };

/**
 * The counters live on `globalThis`, not in module scope.
 *
 * Route handlers are bundled as separate entry points, so each route importing
 * this file got its OWN Map: the limiter code was emitted into three separate
 * chunks (`api/orders`, `api/checkout/session`, `api/auth/login`) and was absent
 * from the shared chunk. Every documented limit was therefore worth double —
 * the two order routes each held a private 60-per-window counter — and the
 * guarantee depended on how the bundler happened to split, so it would have
 * changed silently at the next build. `src/lib/order-events.ts` and
 * `src/lib/prisma.ts` pin their state the same way, for the same reason.
 */
const globalForRateLimit = globalThis as unknown as {
  rateLimitWindows?: Map<string, Window>;
};

const windows = (globalForRateLimit.rateLimitWindows ??= new Map<string, Window>());

/**
 * The limiter is itself a memory-growth vector — one entry per attacking IP —
 * so expired entries are swept once the map gets big rather than being left to
 * accumulate. The sweep is O(size) but only runs when the map crosses the
 * threshold, so the amortised cost per request stays flat.
 */
const SWEEP_THRESHOLD = 5000;

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  if (windows.size > SWEEP_THRESHOLD) sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true };
}
