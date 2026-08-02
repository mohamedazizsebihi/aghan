import { NextResponse, type NextRequest } from "next/server";
import { clientIp, readJsonBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Request budgets for the endpoints a stranger can reach.
 *
 * Order limiting happens in two stages, because the useful key is not knowable
 * until the body has been parsed:
 *
 *   1. `order` below — a coarse per-IP flood gate applied before a single byte
 *      of body is buffered, so a caller hammering the endpoint costs nothing to
 *      reject. Deliberately generous: it must never trip on a real dining room.
 *   2. `ORDER_BUDGET` — the real limit, applied after validation and keyed by
 *      table for dine-in, by IP otherwise. See `checkOrderBudget`.
 */
export const PUBLIC_LIMITS = {
  /**
   * A flood gate, not a business limit — stage 2 is what actually bounds
   * ordering. It has to be counted per IP because nothing else is known this
   * early, and on a hosted deployment that means the whole dining room shares
   * one bucket over the restaurant's WiFi. 60 was low enough that a busy Friday
   * could plausibly reach it (every abandoned form and retry counts), which
   * would have turned a rate limiter into a service outage.
   */
  order: { limit: 300, windowMs: 15 * 60_000, maxBodyBytes: 64 * 1024 },
  /** Password guessing. Deliberately tight; a real owner mistypes a few times. */
  login: { limit: 10, windowMs: 15 * 60_000, maxBodyBytes: 4 * 1024 },
} as const;

/** The per-party allowance, whatever identifies that party. */
export const ORDER_BUDGET = { limit: 10, windowMs: 15 * 60_000 } as const;

type Budget = { limit: number; windowMs: number; maxBodyBytes: number };

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

/**
 * Applies the coarse rate limit and the body cap, in that order, and parses the
 * JSON. Order matters: the limiter runs before any body is buffered.
 */
export async function guardPublicRequest(
  request: NextRequest,
  bucket: string,
  budget: Budget
): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  const limit = rateLimit(`${bucket}:${clientIp(request)}`, budget.limit, budget.windowMs);
  if (!limit.allowed) {
    return { ok: false, response: tooManyRequests(limit.retryAfterSeconds) };
  }

  const body = await readJsonBody(request, budget.maxBodyBytes);
  if (!body.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: body.error }, { status: body.status }),
    };
  }

  return { ok: true, data: body.data };
}

/**
 * The real per-order limit, keyed by whoever is actually ordering.
 *
 * Keying everything on the client IP was correct while orders came from
 * delivery and pickup customers on their own connections. Dine-in inverts that:
 * a room full of customers scanning QR codes is on the restaurant's WiFi, so on
 * a hosted deployment nginx sees **one** address for the entire floor — ten
 * orders per quarter hour for the whole restaurant, and the eleventh table is
 * told to come back later.
 *
 * A dine-in order is therefore counted against its table, which is both immune
 * to shared NAT and a truer unit: one table is one party.
 *
 * Delivery and pickup keep the per-IP budget they always had.
 *
 * CALL ONLY ONCE THE TABLE IS KNOWN TO EXIST AND BE ACTIVE. This used to run
 * straight after schema validation, which merely proves the number is an integer
 * in range — so ten rejected requests naming a table the caller had never sat at
 * (any invalid dish id would do) burned that table's whole budget without
 * creating a single row, and the real customers there were refused for the next
 * quarter of an hour. Table numbers are printed on the cards, so they are public.
 */
export function checkOrderBudget(
  request: NextRequest,
  order: { fulfillmentType: string; tableNumber?: number }
): NextResponse | null {
  const key =
    order.fulfillmentType === "DINE_IN" && order.tableNumber !== undefined
      ? `order:table:${order.tableNumber}`
      : `order:ip:${clientIp(request)}`;

  const limit = rateLimit(key, ORDER_BUDGET.limit, ORDER_BUDGET.windowMs);
  return limit.allowed ? null : tooManyRequests(limit.retryAfterSeconds);
}
