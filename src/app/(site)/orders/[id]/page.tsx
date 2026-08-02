import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PUBLIC_ORDER_SELECT, type TrackedOrder } from "@/lib/order-tracking";
import { OrderTracker } from "@/components/orders/OrderTracker";
import { RememberOrder } from "@/components/orders/RememberOrder";

export const dynamic = "force-dynamic";

/**
 * Public tracking page for one order.
 *
 * Reads through the same projection as the API, so the server-rendered first
 * paint cannot expose more than the stream does.
 */
export default async function TrackOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: PUBLIC_ORDER_SELECT,
  });
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-20">
      {/* Opening a tracking link on a second device adds it there too. */}
      <RememberOrder id={order.id} orderNumber={order.orderNumber} />

      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> My orders
      </Link>

      <h1 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">
        Your order
      </h1>

      <div className="mt-8">
        <OrderTracker
          orderId={order.id}
          initialOrder={order as unknown as TrackedOrder}
        />
      </div>
    </div>
  );
}
