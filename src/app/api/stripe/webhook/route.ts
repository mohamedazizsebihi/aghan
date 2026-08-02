import { NextResponse, type NextRequest } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  cancelUnpaidOrder,
  markOrderPaid,
  markOrderRefunded,
} from "@/lib/order-payments";

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  /**
   * Everything below is idempotent, because Stripe replays.
   *
   * A 500 from here puts the event into Stripe's backoff queue for up to three
   * days, so a failure that would fail identically on every replay — an order id
   * that no longer exists, a session that isn't the one on file — is answered
   * with 200 and logged. Only genuinely transient failures are worth a retry.
   */
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;
        if (!orderId) break;

        // Stripe reports `payment_status` separately from session completion:
        // an async method can complete the session while still unpaid.
        if (session.payment_status !== "paid") break;

        const result = await markOrderPaid(orderId, {
          sessionId: session.id,
          amountTotal: session.amount_total,
        });
        if (!result.ok) {
          console.error("Stripe webhook could not reconcile payment", {
            orderId,
            reason: result.reason,
          });
        }
        break;
      }

      case "checkout.session.expired": {
        const orderId = event.data.object.metadata?.orderId;
        // Without this the row sat PENDING for ever: nothing else ever cleaned
        // up an order whose customer simply closed the Stripe tab.
        if (orderId) await cancelUnpaidOrder(orderId);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const paymentIntent =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (!paymentIntent) break;

        // A Charge carries no order id — only the checkout session that created
        // it does, so it has to be looked back up.
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: paymentIntent,
          limit: 1,
        });
        const orderId = sessions.data[0]?.metadata?.orderId;
        if (orderId) await markOrderRefunded(orderId);
        break;
      }
    }
  } catch (error) {
    console.error("Stripe webhook handler failed", event.type, error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
