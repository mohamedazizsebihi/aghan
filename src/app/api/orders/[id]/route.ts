import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { orderUpdateSchema } from "@/lib/validators";
import { publishOrderChanged } from "@/lib/order-events";
import { canTransition } from "@/lib/order-state";
import { Prisma } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

function notFound() {
  return NextResponse.json({ error: "Order not found" }, { status: 404 });
}

/** P2025 — the row vanished between the admin loading the page and acting on it. */
function isMissingRow(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
  );
}

/**
 * Full order, staff only.
 *
 * This used to be unauthenticated, and returned the whole row — name, email,
 * phone, delivery address, Stripe session id — to anyone holding an order id.
 * Ids travel in URLs, browser history, and referrers, so unguessability was
 * never access control. Customers now use `./status` and `./stream`, which
 * serve a projection with no contact details in it at all.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) return notFound();
  return NextResponse.json({ order });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = orderUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const current = await prisma.order.findUnique({
    where: { id },
    select: { status: true, fulfillmentType: true },
  });
  if (!current) return notFound();

  // The schema only proves the value is in the enum. Without this, COMPLETED
  // could be walked back to PENDING and a cancelled order resurrected — and the
  // dropdown offered every status at all times, so it was one mis-click away.
  if (
    parsed.data.status &&
    !canTransition(current.status, parsed.data.status, current.fulfillmentType)
  ) {
    return NextResponse.json(
      {
        error: `An order that is ${current.status} cannot become ${parsed.data.status}.`,
      },
      { status: 409 }
    );
  }

  try {
    const order = await prisma.order.update({
      where: { id },
      data: parsed.data,
    });

    // Wakes every live tracker watching this order — this is the moment the
    // customer's page moves, not the next time they refresh.
    publishOrderChanged(id);

    return NextResponse.json({ order });
  } catch (error) {
    if (isMissingRow(error)) return notFound();
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Deleting cascades to the OrderItem rows, so a paid order would take the
  // record of what the money was for with it. One window.confirm is not enough
  // standing between staff and destroying an accounting record; cancelling
  // keeps the row and reads the same on every screen.
  const existing = await prisma.order.findUnique({
    where: { id },
    select: { paymentStatus: true },
  });
  if (!existing) return notFound();
  if (existing.paymentStatus === "PAID") {
    return NextResponse.json(
      { error: "A paid order cannot be deleted. Cancel or refund it instead." },
      { status: 409 }
    );
  }

  try {
    await prisma.order.delete({ where: { id } });
  } catch (error) {
    if (isMissingRow(error)) return notFound();
    throw error;
  }

  // Takes it off the other screens too, and tells anyone tracking it that it
  // is gone rather than leaving them on a stream that never speaks again.
  publishOrderChanged(id);

  return NextResponse.json({ success: true });
}
