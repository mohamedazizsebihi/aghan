import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { PUBLIC_ORDER_SELECT } from "@/lib/order-tracking";

type Params = { params: Promise<{ id: string }> };

/**
 * Public order tracking, one shot.
 *
 * Unauthenticated on purpose — a customer tracking their own order has no
 * account — which is precisely why it returns `PUBLIC_ORDER_SELECT` and never
 * the row. The SSE stream alongside it serves the same projection; this one
 * exists for the first paint and for any client that cannot hold a stream open.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: PUBLIC_ORDER_SELECT,
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(
    { order },
    { headers: { "Cache-Control": "no-store" } }
  );
}
