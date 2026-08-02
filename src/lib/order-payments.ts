import { prisma } from "@/lib/prisma";
import { publishOrderChanged } from "@/lib/order-events";

/**
 * Reconciling a Stripe payment onto an Order.
 *
 * Shared by the webhook and the confirmation page, which both learn about the
 * same payment by different routes and can arrive in either order — or twice.
 * Every function here is therefore idempotent and conditional: it states what it
 * expects to be true and writes nothing if it isn't, rather than overwriting
 * whatever the kitchen has done in the meantime.
 */

export type ReconcileResult =
  | { ok: true; changed: boolean }
  /** Nothing to retry: replaying the event would fail identically. */
  | { ok: false; reason: "unknown-order" | "session-mismatch" | "amount-mismatch" };

/**
 * Records that a checkout session was paid.
 *
 * `expectedSessionId` and `amountTotal` are checked against the stored order
 * because the session id travels in a URL the customer can edit: without them,
 * anyone could confirm anyone's order by pasting a session id of their own.
 */
export async function markOrderPaid(
  orderId: string,
  { sessionId, amountTotal }: { sessionId: string; amountTotal: number | null },
): Promise<ReconcileResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, total: true, stripeSessionId: true, paymentStatus: true },
  });
  if (!order) return { ok: false, reason: "unknown-order" };
  if (order.stripeSessionId && order.stripeSessionId !== sessionId) {
    return { ok: false, reason: "session-mismatch" };
  }
  if (amountTotal !== null && amountTotal !== order.total) {
    return { ok: false, reason: "amount-mismatch" };
  }

  // Payment is a fact about money, so record it even on an order staff has
  // already cancelled — that surfaces the refund the customer is owed instead of
  // silently dropping it.
  const paid = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: { not: "PAID" } },
    data: { paymentStatus: "PAID" },
  });

  // Status is a workflow, not a fact about money. Only the first step is the
  // payment's to take: an order already being prepared, completed or cancelled
  // must not be dragged back to CONFIRMED by a webhook retry days later.
  const advanced = await prisma.order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "CONFIRMED" },
  });

  const changed = paid.count > 0 || advanced.count > 0;
  if (changed) publishOrderChanged(orderId);
  return { ok: true, changed };
}

/**
 * The customer closed the Stripe tab, or the session timed out.
 *
 * Only ever cancels an order that is still waiting for that payment — the same
 * customer may have come back and paid on a second session.
 */
export async function cancelUnpaidOrder(orderId: string): Promise<ReconcileResult> {
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: "UNPAID", status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (count > 0) publishOrderChanged(orderId);
  return { ok: true, changed: count > 0 };
}

export async function markOrderRefunded(orderId: string): Promise<ReconcileResult> {
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: "PAID" },
    data: { paymentStatus: "REFUNDED" },
  });
  if (count > 0) publishOrderChanged(orderId);
  return { ok: true, changed: count > 0 };
}
