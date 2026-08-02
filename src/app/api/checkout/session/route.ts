import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { buildOrderFromCart, createOrder, OrderBuildError } from "@/lib/orders";
import { cardOrderSchema } from "@/lib/validators";
import { CURRENCY } from "@/lib/constants";
import {
  checkOrderBudget,
  guardPublicRequest,
  PUBLIC_LIMITS,
} from "@/lib/api-limits";
import { requireBaseUrl } from "@/lib/base-url";

export async function POST(request: NextRequest) {
  if (!stripeEnabled || !stripe) {
    return NextResponse.json(
      { error: "Online card payments are not configured yet." },
      { status: 503 }
    );
  }

  // Shares the "order" budget with the cash route — both create Order rows.
  const guard = await guardPublicRequest(request, "order", PUBLIC_LIMITS.order);
  if (!guard.ok) return guard.response;

  const parsed = cardOrderSchema.safeParse(guard.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid order data" },
      { status: 400 }
    );
  }

  // Card orders are never dine-in (cardOrderSchema refuses it), so this always
  // keys on the IP — the budget delivery and pickup have always had.
  const overBudget = checkOrderBudget(request, parsed.data);
  if (overBudget) return overBudget;

  try {
    const orderData = await buildOrderFromCart(parsed.data);
    const order = await createOrder({
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      customerPhone: orderData.customerPhone,
      fulfillmentType: orderData.fulfillmentType,
      deliveryAddress: orderData.deliveryAddress,
      tableNumber: orderData.tableNumber,
      notes: orderData.notes,
      paymentMethod: "CARD",
      paymentStatus: "UNPAID",
      status: "PENDING",
      subtotal: orderData.subtotal,
      deliveryFee: orderData.deliveryFee,
      total: orderData.total,
      items: { create: orderData.orderItems },
    });

    // Resolved per request, never from NEXT_PUBLIC_*: that is substituted at
    // build time, so the image shipped these redirects pointing at
    // http://localhost:3000 and customers paid then landed on a dead address.
    const baseUrl = await requireBaseUrl();

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = orderData.orderItems.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: CURRENCY,
        unit_amount: item.priceSnapshot,
        product_data: { name: item.nameSnapshot },
      },
    }));

    if (orderData.deliveryFee > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: orderData.deliveryFee,
          product_data: { name: "Delivery Fee" },
        },
      });
    }

    // The Order row is already committed, and its id is baked into the redirect
    // URLs below, so it cannot be created after the session. If anything past
    // this point fails, the row must be cancelled rather than left behind: an
    // order with no stripeSessionId can never be reconciled by the webhook, and
    // nothing else sweeps them up.
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        // From the parsed input, not the built order: cardOrderSchema types this
        // as a required string, whereas the builder's output is nullable to serve
        // cash dine-in orders too.
        customer_email: parsed.data.customerEmail,
        line_items: lineItems,
        success_url: `${baseUrl}/checkout/success?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/checkout/cancel?orderId=${order.id}`,
        metadata: { orderId: order.id },
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { stripeSessionId: session.id },
      });
    } catch (error) {
      await prisma.order
        .update({
          where: { id: order.id },
          data: { status: "CANCELLED" },
        })
        .catch(() => {
          // Losing the compensation is worse than losing the original error,
          // so surface that rather than throwing from the cleanup path.
          console.error("Could not cancel order after checkout failure", order.id);
        });
      throw error;
    }

    // Deliberately no publishOrderChanged here. Nothing has been paid yet, and
    // publishing lights up the kitchen's live list and rings the alert sound —
    // staff would start cooking an order the customer may never pay for. The
    // Stripe webhook announces the order once payment actually lands.
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof OrderBuildError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong starting checkout." },
      { status: 500 }
    );
  }
}
