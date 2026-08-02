"use client";

import { useEffect, useState } from "react";
import { isFinished, type TrackedOrder } from "@/lib/order-tracking";

type TrackingState = {
  order: TrackedOrder | null;
  /** True while a stream is actually connected — drives the "live" indicator. */
  live: boolean;
  gone: boolean;
};

/**
 * Subscribes to one order's live status.
 *
 * `EventSource` rather than a polling loop: the customer sees the kitchen's
 * action as it happens. It also reconnects on its own after a dropped
 * connection, which a hand-rolled fetch loop would have to reimplement.
 *
 * That automatic retry is also the trap. The server closes the stream once an
 * order is served or cancelled, and `EventSource` cannot tell a deliberate
 * close from a dropped one — it would reconnect, be served the same final
 * status, be closed again, forever. So the client closes from its side as soon
 * as it sees a terminal status, and never opens a stream for an order that is
 * already finished.
 */
export function useOrderTracking(orderId: string, initial: TrackedOrder | null) {
  const [state, setState] = useState<TrackingState>({
    order: initial,
    live: false,
    gone: false,
  });

  const alreadyFinished = initial ? isFinished(initial.status) : false;

  useEffect(() => {
    if (!orderId || alreadyFinished) return;

    const source = new EventSource(`/api/orders/${orderId}/stream`);
    let closed = false;

    const stop = () => {
      if (closed) return;
      closed = true;
      source.close();
      setState((s) => ({ ...s, live: false }));
    };

    source.addEventListener("open", () => {
      setState((s) => ({ ...s, live: true }));
    });

    source.addEventListener("order", (event) => {
      try {
        const { order } = JSON.parse((event as MessageEvent).data) as {
          order: TrackedOrder;
        };
        setState({ order, live: !isFinished(order.status), gone: false });
        // Nothing more will happen: close before the server does, so its close
        // is never mistaken for a dropped connection worth retrying.
        if (isFinished(order.status)) stop();
      } catch {
        // A malformed frame is not worth tearing the connection down for.
      }
    });

    source.addEventListener("gone", () => {
      setState((s) => ({ ...s, gone: true, live: false }));
      stop();
    });

    source.addEventListener("error", () => {
      // EventSource retries by itself; only reflect that we are not live.
      setState((s) => ({ ...s, live: false }));
    });

    return stop;
  }, [orderId, alreadyFinished]);

  return state;
}
