import type { NextRequest } from "next/server";

/**
 * Best available client address, for rate-limiting keys.
 *
 * `X-Real-IP` is set by our own nginx from `$remote_addr` (nginx/conf.d/
 * default.conf) and `proxy_set_header` *replaces* any value the client sent,
 * so it is trustworthy. `X-Forwarded-For` is built with
 * `$proxy_add_x_forwarded_for`, which *appends* — the leftmost entries are
 * whatever the caller claimed, and only the rightmost was observed by nginx.
 * Hence: X-Real-IP first, rightmost XFF second, never the leftmost.
 *
 * This assumes the app is only reachable through nginx, which docker-compose.yml
 * enforces by publishing ports on the nginx service alone. If the Node server is
 * ever exposed directly, these headers become client-controlled and callers can
 * sidestep the limiter by rotating them — everything then shares the "unknown"
 * bucket, which throttles in aggregate rather than failing open.
 */
export function clientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return "unknown";
}

export type JsonBodyResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

/**
 * Reads and parses a JSON body, refusing to buffer more than `maxBytes`.
 *
 * `await request.json()` reads the whole body into memory before anything can
 * inspect it, so a validator — however strict — only ever sees a payload the
 * process has already paid for. The cap has to be applied while reading, which
 * means consuming the stream by hand.
 *
 * Content-Length is checked first as a cheap early exit, but it is a claim, not
 * a guarantee: it is absent on chunked bodies and can understate the truth. The
 * running total during the read is what actually enforces the limit.
 */
export async function readJsonBody(
  request: NextRequest,
  maxBytes: number
): Promise<JsonBodyResult> {
  const tooLarge = {
    ok: false,
    status: 413,
    error: "That request is too large.",
  } as const;

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge;

  const body = request.body;
  if (!body) return { ok: false, status: 400, error: "Missing request body." };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        // Stop pulling; the sender is cut off rather than allowed to keep
        // streaming into a buffer we have already decided to discard.
        await reader.cancel().catch(() => {});
        return tooLarge;
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, error: "Could not read the request body." };
  }

  try {
    return { ok: true, data: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON." };
  }
}
