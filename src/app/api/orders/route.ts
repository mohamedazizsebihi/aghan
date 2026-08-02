import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { buildOrderFromCart, createOrder, OrderBuildError } from "@/lib/orders";
import { cashOrderSchema, orderStatusSchema } from "@/lib/validators";
import {
  checkOrderBudget,
  guardPublicRequest,
  PUBLIC_LIMITS,
} from "@/lib/api-limits";
import { publishOrderChanged } from "@/lib/order-events";

/** Cash orders. The schema is payment-method specific — see validators.ts. */
export async function POST(request: NextRequest) {
  const guard = await guardPublicRequest(request, "order", PUBLIC_LIMITS.order);
  if (!guard.ok) return guard.response;

  const parsed = cashOrderSchema.safeParse(guard.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid order data" },
      { status: 400 }
    );
  }

  try {
    // buildOrderFromCart is what proves the table exists and is active, so the
    // budget is charged only after it returns. Charging on the schema alone let
    // a stranger spend a real table's allowance with requests that never
    // created anything — see checkOrderBudget. Requests that fail here are
    // still covered by the per-IP flood gate above.
    const orderData = await buildOrderFromCart(parsed.data);

    const overBudget = checkOrderBudget(request, parsed.data);
    if (overBudget) return overBudget;

    const order = await createOrder({
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      customerPhone: orderData.customerPhone,
      fulfillmentType: orderData.fulfillmentType,
      deliveryAddress: orderData.deliveryAddress,
      tableNumber: orderData.tableNumber,
      notes: orderData.notes,
      paymentMethod: "CASH",
      paymentStatus: "UNPAID",
      status: "PENDING",
      subtotal: orderData.subtotal,
      deliveryFee: orderData.deliveryFee,
      total: orderData.total,
      items: { create: orderData.orderItems },
    });

    // Puts it on every open admin screen straight away — nobody should have to
    // refresh to discover that food has been ordered.
    publishOrderChanged(order.id);

    return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber });
  } catch (error) {
    if (error instanceof OrderBuildError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong placing your order." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statusParam = request.nextUrl.searchParams.get("status");
  const statusResult = statusParam
    ? orderStatusSchema.shape.status.safeParse(statusParam)
    : null;

  const orders = await prisma.order.findMany({
    where: statusResult?.success ? { status: statusResult.data } : undefined,
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}
