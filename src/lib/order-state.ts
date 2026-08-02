import type { FulfillmentType, OrderStatus } from "@/generated/prisma/client";

/**
 * Which order status can follow which.
 *
 * Nothing enforced this before: the update schema only checked that the value
 * was a member of the enum, so COMPLETED could go back to PENDING, a CANCELLED
 * order could be walked into PREPARING, and a dine-in order could be marked "out
 * for delivery". Pure and synchronous so both the API and the admin dropdown can
 * ask the same question and give the same answer.
 */

/** Reached by finishing or abandoning. Staff have no reason to leave either. */
const TERMINAL: readonly OrderStatus[] = ["COMPLETED", "CANCELLED"];

/**
 * READY means different things per fulfillment type, and only delivery has a
 * step after it — offering "out for delivery" on a dine-in order was how an
 * order could end up in a state its own tracker cannot render (order-tracking.ts
 * returns -1 for it, which is why that guard exists).
 */
function afterReady(fulfillmentType: FulfillmentType): OrderStatus[] {
  return fulfillmentType === "DELIVERY"
    ? ["OUT_FOR_DELIVERY", "COMPLETED"]
    : ["COMPLETED"];
}

export function allowedNext(
  status: OrderStatus,
  fulfillmentType: FulfillmentType,
): OrderStatus[] {
  switch (status) {
    case "PENDING":
      return ["CONFIRMED", "CANCELLED"];
    case "CONFIRMED":
      return ["PREPARING", "CANCELLED"];
    case "PREPARING":
      return ["READY", "CANCELLED"];
    case "READY":
      return [...afterReady(fulfillmentType), "CANCELLED"];
    case "OUT_FOR_DELIVERY":
      return ["COMPLETED", "CANCELLED"];
    case "COMPLETED":
    case "CANCELLED":
      return [];
  }
}

export function isTerminal(status: OrderStatus) {
  return TERMINAL.includes(status);
}

/**
 * Re-selecting the current status is allowed so that a double-click, or two
 * tablets sending the same move, is a no-op rather than a 409.
 */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  fulfillmentType: FulfillmentType,
) {
  return from === to || allowedNext(from, fulfillmentType).includes(to);
}
