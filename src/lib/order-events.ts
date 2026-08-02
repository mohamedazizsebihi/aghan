/**
 * In-process notification that an order changed.
 *
 * SQLite has no LISTEN/NOTIFY, so "the kitchen moved this order along" has to
 * travel through the process itself: the admin's PATCH publishes, and every SSE
 * stream watching that order wakes up and re-reads it.
 *
 * Per-process, which is exactly this deployment (one Node container, one SQLite
 * file — see docker-compose.yml), and the same constraint already documented
 * for the AR generation lock and the rate limiter. A second app instance would
 * only notify its own listeners; that setup needs a shared bus, or the streams
 * falling back on their periodic re-read, which is why that re-read exists.
 *
 * Deliberately carries no payload. Listeners re-read from the database instead,
 * so there is one source of truth and no risk of publishing a stale snapshot
 * that disagrees with what a refresh would show.
 */

type Listener = () => void;

/**
 * The registry lives on `globalThis`, not in module scope.
 *
 * Route handlers are bundled as separate entry points, so two routes importing
 * this file can each get their own instance of it — a plain module-level Map
 * meant the admin's PATCH published into one Map while the SSE stream was
 * listening on another, and nothing was ever delivered. (Verified: the stream
 * opened, sent its first frame, and then never moved.) `src/lib/prisma.ts`
 * pins its client the same way, for the same reason.
 */
const globalForOrderEvents = globalThis as unknown as {
  orderEventListeners?: Map<string, Set<Listener>>;
  allOrderListeners?: Set<Listener>;
};

const listeners = (globalForOrderEvents.orderEventListeners ??= new Map<
  string,
  Set<Listener>
>());

/**
 * Watchers of the collection rather than of one order — the admin order list,
 * which needs to hear about orders that did not exist when it subscribed. A
 * per-order subscription cannot express "tell me when a new one arrives".
 */
const allListeners = (globalForOrderEvents.allOrderListeners ??= new Set<Listener>());

export function subscribeToOrder(orderId: string, listener: Listener) {
  let forOrder = listeners.get(orderId);
  if (!forOrder) {
    forOrder = new Set();
    listeners.set(orderId, forOrder);
  }
  forOrder.add(listener);

  return () => {
    forOrder.delete(listener);
    // Drop the bucket once empty; otherwise the map grows by one entry per
    // order ever watched and never shrinks.
    if (forOrder.size === 0) listeners.delete(orderId);
  };
}

export function subscribeToAllOrders(listener: Listener) {
  allListeners.add(listener);
  return () => {
    allListeners.delete(listener);
  };
}

function notify(target: Iterable<Listener>) {
  for (const listener of target) {
    // One listener throwing must not stop the others from being told.
    try {
      listener();
    } catch (error) {
      console.error("[order-events] listener failed", error);
    }
  }
}

/**
 * Anything that changed an order: created, status moved, payment confirmed,
 * deleted. Reaches both the customer watching that one order and every admin
 * screen watching the list.
 */
export function publishOrderChanged(orderId: string) {
  const forOrder = listeners.get(orderId);
  if (forOrder) notify(forOrder);
  notify(allListeners);
}

/** Number of streams currently open, for the connection cap in the SSE route. */
export function openStreamCount() {
  let total = 0;
  for (const forOrder of listeners.values()) total += forOrder.size;
  return total;
}
