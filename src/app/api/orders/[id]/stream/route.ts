import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { openStreamCount, subscribeToOrder } from "@/lib/order-events";
import { isFinished, PUBLIC_ORDER_SELECT } from "@/lib/order-tracking";

type Params = { params: Promise<{ id: string }> };

/** Keeps proxies from closing an idle connection. nginx defaults to 60s. */
const HEARTBEAT_MS = 25_000;

/**
 * Safety net for the in-process bus: a change published by another app instance
 * (or missed for any reason) still reaches the customer within this window.
 * Long enough that it is not polling in disguise.
 */
const RESYNC_MS = 60_000;

/**
 * A stream is a held-open connection on a single Node process, so the count is
 * bounded rather than left to grow. Beyond this the client falls back to the
 * one-shot /status endpoint, which is stateless.
 */
const MAX_CONCURRENT_STREAMS = 200;

/**
 * Live order tracking over Server-Sent Events.
 *
 * Pushes a fresh public projection whenever the order changes — the admin
 * moving it along, or Stripe confirming payment — so the customer sees the
 * kitchen's action rather than discovering it on the next poll.
 *
 * Serves the same `PUBLIC_ORDER_SELECT` as /status: no contact details, no
 * address, no Stripe session id.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const initial = await prisma.order.findUnique({
    where: { id },
    select: PUBLIC_ORDER_SELECT,
  });
  if (!initial) {
    return new Response(JSON.stringify({ error: "Order not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (openStreamCount() >= MAX_CONCURRENT_STREAMS) {
    // 503 + Retry-After, so the client knows to fall back rather than hammer.
    return new Response(JSON.stringify({ error: "Too many live connections" }), {
      status: 503,
      headers: { "Content-Type": "application/json", "Retry-After": "30" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let lastSerialised = "";

      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        clearInterval(resync);
        request.signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {
          // Already closed by the runtime when the client vanished.
        }
      };

      const send = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          close();
        }
      };

      const push = async () => {
        if (closed) return;
        const order = await prisma.order
          .findUnique({ where: { id }, select: PUBLIC_ORDER_SELECT })
          .catch(() => null);

        if (!order) {
          // Deleted by an admin mid-stream — say so rather than going silent.
          send("gone", JSON.stringify({ id }));
          close();
          return;
        }

        const serialised = JSON.stringify({ order });
        // The bus fires on any write; only spend a frame when something the
        // customer can actually see has changed.
        if (serialised === lastSerialised) return;
        lastSerialised = serialised;
        send("order", serialised);

        // Nothing further will ever happen to this order, so holding the
        // connection open would cost a socket for no reason.
        if (isFinished(order.status)) close();
      };

      const unsubscribe = subscribeToOrder(id, () => {
        void push();
      });

      const heartbeat = setInterval(() => {
        // A comment frame: ignored by EventSource, enough to reset proxy idle
        // timers.
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            close();
          }
        }
      }, HEARTBEAT_MS);

      const resync = setInterval(() => void push(), RESYNC_MS);

      request.signal.addEventListener("abort", close);

      // First frame immediately, so the client renders without waiting for a
      // change it may already have missed.
      void push();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Belt and braces with nginx's `proxy_buffering off` — this header turns
      // buffering off for this response even if that directive is ever dropped.
      "X-Accel-Buffering": "no",
    },
  });
}
