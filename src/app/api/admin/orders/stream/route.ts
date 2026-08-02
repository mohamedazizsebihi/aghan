import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { subscribeToAllOrders } from "@/lib/order-events";

const HEARTBEAT_MS = 25_000;

/**
 * Tells open admin screens that the order list changed.
 *
 * Carries **no order data at all** — just the word "changed". The page then
 * re-renders on the server, which is what keeps sorting, filtering and the row
 * markup written once instead of duplicated into a client bundle that could
 * drift from it. It also means this stream cannot leak a customer's details
 * even though it stays open for hours.
 *
 * Still requires an admin session: the existence and timing of orders is itself
 * information about the business.
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        request.signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {
          // Already closed by the runtime when the client vanished.
        }
      };

      const write = (frame: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(frame));
        } catch {
          close();
        }
      };

      const unsubscribe = subscribeToAllOrders(() => {
        // A bare signal. The client decides what to do with it, and coalesces
        // bursts so a rush of orders is one re-render rather than five.
        write(`event: changed\ndata: {}\n\n`);
      });

      const heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);

      request.signal.addEventListener("abort", close);

      // Lets the client mark itself connected without waiting for an order.
      write(`event: ready\ndata: {}\n\n`);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
