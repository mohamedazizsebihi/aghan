import type { FulfillmentType, OrderStatus } from "@/generated/prisma/client";

/**
 * Order tracking, as the *customer* is allowed to see it.
 *
 * Two things live here: what a public caller may read, and how the raw status
 * enum reads to someone waiting for food.
 */

/**
 * The only fields a public tracking response may contain.
 *
 * An explicit Prisma `select` rather than picking fields off a full row: adding
 * a column to Order must not silently start publishing it. Notably absent —
 * customerEmail, customerPhone, deliveryAddress, stripeSessionId — which the
 * old unauthenticated `GET /api/orders/[id]` returned to anyone holding an id.
 */
export const PUBLIC_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  fulfillmentType: true,
  tableNumber: true,
  subtotal: true,
  deliveryFee: true,
  total: true,
  createdAt: true,
  // `updatedAt` is deliberately absent. Nothing renders it, and including it
  // made every write look like a change to the stream's de-duplication — a
  // no-op status save pushed a frame that showed the customer nothing new.
  items: {
    select: { id: true, nameSnapshot: true, priceSnapshot: true, quantity: true },
  },
} as const;

export type TrackedOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentType: FulfillmentType;
  tableNumber: number | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string | Date;
  items: {
    id: string;
    nameSnapshot: string;
    priceSnapshot: number;
    quantity: number;
  }[];
};

export type TrackingStep = {
  label: string;
  /** Every status that counts as "this step is the current one". */
  covers: OrderStatus[];
};

/**
 * The stages of an order, per fulfillment type.
 *
 * A customer at table 7 must never be shown "out for delivery", and someone
 * waiting on a bike must never be told their food is being carried over — so
 * the third stage, the one that actually differs, is written out per type
 * rather than shared.
 *
 * `READY` means different things by type, which is why it is grouped rather
 * than given a step of its own everywhere: for delivery it means "waiting for
 * the driver", still part of preparation from the customer's side.
 */
const STEPS: Record<FulfillmentType, TrackingStep[]> = {
  DINE_IN: [
    { label: "Order received", covers: ["PENDING", "CONFIRMED"] },
    { label: "Being prepared", covers: ["PREPARING"] },
    { label: "On its way to your table", covers: ["READY"] },
    { label: "Served", covers: ["COMPLETED"] },
  ],
  PICKUP: [
    { label: "Order received", covers: ["PENDING", "CONFIRMED"] },
    { label: "Being prepared", covers: ["PREPARING"] },
    { label: "Ready for collection", covers: ["READY"] },
    { label: "Collected", covers: ["COMPLETED"] },
  ],
  DELIVERY: [
    { label: "Order received", covers: ["PENDING", "CONFIRMED"] },
    { label: "Being prepared", covers: ["PREPARING", "READY"] },
    { label: "Out for delivery", covers: ["OUT_FOR_DELIVERY"] },
    { label: "Delivered", covers: ["COMPLETED"] },
  ],
};

export function trackingSteps(fulfillmentType: FulfillmentType) {
  return STEPS[fulfillmentType] ?? STEPS.PICKUP;
}

/**
 * Which step the order is on, or -1 when the status has no place in this
 * type's sequence.
 *
 * That happens when staff set a status the type doesn't use — the admin can put
 * any order into any status, so "out for delivery" on a dine-in order is
 * reachable. Returning -1 lets the UI say something honest instead of
 * highlighting a step at random.
 */
export function currentStepIndex(
  fulfillmentType: FulfillmentType,
  status: OrderStatus
) {
  return trackingSteps(fulfillmentType).findIndex((step) =>
    step.covers.includes(status)
  );
}

export function isCancelled(status: OrderStatus) {
  return status === "CANCELLED";
}

/**
 * Whether anything more is expected to happen. Drives both the "live" indicator
 * and, more importantly, whether the client keeps a stream open at all.
 */
export function isFinished(status: OrderStatus) {
  return status === "COMPLETED" || status === "CANCELLED";
}
