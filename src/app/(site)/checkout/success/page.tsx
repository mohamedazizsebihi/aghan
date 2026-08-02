import { CheckCircle2, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/Button";
import { PUBLIC_ORDER_SELECT, type TrackedOrder } from "@/lib/order-tracking";
import { OrderTracker } from "@/components/orders/OrderTracker";
import { RememberOrder } from "@/components/orders/RememberOrder";
import { ClearCartOnMount } from "@/components/checkout/ClearCartOnMount";
import { stripe } from "@/lib/stripe";
import { markOrderPaid } from "@/lib/order-payments";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; session_id?: string }>;
}) {
  const { orderId, session_id: sessionId } = await searchParams;

  /**
   * Fallback reconciliation, for when the webhook hasn't landed yet.
   *
   * The webhook used to be the only path to PAID, so a customer who paid and
   * came straight back saw "unpaid" — and if the webhook never arrived at all,
   * the order stayed that way for good. Stripe already puts the session id in
   * this URL; it just wasn't read. `markOrderPaid` checks it against the id
   * stored on the order and compares the amount, so a guessed or borrowed
   * session id confirms nothing.
   *
   * Failures here are swallowed on purpose: a Stripe outage must not stop the
   * customer seeing the order they just placed.
   */
  if (orderId && sessionId && stripe) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") {
        await markOrderPaid(orderId, {
          sessionId: session.id,
          amountTotal: session.amount_total,
        });
      }
    } catch (error) {
      console.error("Could not reconcile checkout session", sessionId, error);
    }
  }

  /**
   * Strictly the public projection.
   *
   * This page has no access control — the order id is the only capability, and
   * it travels through browser history and the `Referer` header. It also widened
   * the projection with `customerName` and `deliveryAddress`, which are not
   * "server-side" in any sense: everything rendered here ships in the HTML and
   * in the RSC payload, so anyone holding an id could read the customer's name
   * and home address (verified with `curl`, no cookie). Whatever this page needs
   * to show, it can only be what `PUBLIC_ORDER_SELECT` allows.
   */
  const order = orderId
    ? await prisma.order.findUnique({
        where: { id: orderId },
        select: PUBLIC_ORDER_SELECT,
      })
    : null;

  if (!order) {
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-ink">
          Order Not Found
        </h1>
        <p className="mt-3 text-ink/60">
          We couldn&rsquo;t find that order. If you just placed one, check your
          email for confirmation.
        </p>
        <LinkButton href="/menu" className="mt-8">
          Back to Menu
        </LinkButton>
      </div>
    );
  }

  const pendingCardPayment =
    order.paymentMethod === "CARD" && order.paymentStatus !== "PAID";

  return (
    <div className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-8">
      <ClearCartOnMount />
      <RememberOrder id={order.id} orderNumber={order.orderNumber} />

      {pendingCardPayment ? (
        <Clock className="mx-auto h-14 w-14 text-gold-500" />
      ) : (
        <CheckCircle2 className="mx-auto h-14 w-14 text-green-700" />
      )}

      <h1 className="mt-6 font-display text-4xl font-bold text-ink">
        {pendingCardPayment ? "Confirming Payment…" : "Order Confirmed!"}
      </h1>
      <p className="mt-3 text-ink/60">
        {pendingCardPayment
          ? "We're confirming your payment with Stripe. This page updates by itself."
          : "Thank you! We're preparing your order now."}
      </p>

      <div className="mt-10 text-left">
        <OrderTracker orderId={order.id} initialOrder={order as TrackedOrder} />
        <p className="mt-4 text-center text-sm text-ink/50">
          {order.fulfillmentType === "DELIVERY"
            ? "Delivering to the address you gave us"
            : order.fulfillmentType === "DINE_IN"
              ? `Being served to Table ${order.tableNumber}`
              : "Ready for pickup at Bagh-e-Kabul"}
        </p>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <LinkButton href="/menu" variant="secondary" size="lg">
          Order More
        </LinkButton>
        <LinkButton href="/orders" variant="ghost" size="lg">
          My Orders
        </LinkButton>
      </div>
    </div>
  );
}
