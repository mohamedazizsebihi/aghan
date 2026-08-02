import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, UtensilsCrossed } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { fulfillmentLabel, orderCustomerLabel } from "@/lib/constants";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { PaymentStatusButton } from "@/components/admin/PaymentStatusButton";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) notFound();

  return (
    <div>
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-ink/50">
            Placed{" "}
            {order.createdAt.toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OrderStatusSelect
            orderId={order.id}
            status={order.status}
            fulfillmentType={order.fulfillmentType}
          />
          <DeleteButton
            url={`/api/orders/${order.id}`}
            confirmMessage="Delete this order permanently?"
            label="Delete"
          />
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink/5">
          <h2 className="font-display text-lg font-semibold text-ink">Items</h2>
          <div className="mt-4 divide-y divide-ink/5">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between py-3 text-sm">
                <span className="text-ink/80">
                  {item.quantity} × {item.nameSnapshot}
                </span>
                <span className="font-medium text-ink">
                  {formatPrice(item.priceSnapshot * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-ink/10 pt-4 text-sm">
            <div className="flex justify-between text-ink/60">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink/60">
              <span>Delivery Fee</span>
              <span>{formatPrice(order.deliveryFee)}</span>
            </div>
            <div className="flex justify-between font-display text-lg font-semibold text-ink">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink/5">
            <h2 className="font-display text-lg font-semibold text-ink">
              Customer
            </h2>
            <div className="mt-3 space-y-1 text-sm text-ink/70">
              <p className="font-medium text-ink">{orderCustomerLabel(order)}</p>
              {order.customerEmail && <p>{order.customerEmail}</p>}
              {order.customerPhone && <p>{order.customerPhone}</p>}
              {!order.customerEmail && !order.customerPhone && (
                <p className="text-ink/40">
                  No contact details — ordered at the table, paying cash.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink/5">
            <h2 className="font-display text-lg font-semibold text-ink">
              Fulfillment
            </h2>
            <div className="mt-3 space-y-2 text-sm text-ink/70">
              <p className="font-medium text-ink">
                {fulfillmentLabel(order.fulfillmentType, order.tableNumber)}
              </p>
              {order.fulfillmentType === "DINE_IN" && order.tableNumber != null && (
                <p className="inline-flex items-center gap-1.5 rounded-lg bg-green-900/10 px-3 py-1.5 font-display text-base font-semibold text-green-800">
                  <UtensilsCrossed className="h-4 w-4" />
                  Table {order.tableNumber}
                </p>
              )}
              {order.deliveryAddress && <p>{order.deliveryAddress}</p>}
              {order.notes && (
                <p className="italic text-ink/50">&ldquo;{order.notes}&rdquo;</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink/5">
            <h2 className="font-display text-lg font-semibold text-ink">
              Payment
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{order.paymentMethod}</Badge>
              <Badge tone={order.paymentStatus === "PAID" ? "green" : "gold"}>
                {order.paymentStatus}
              </Badge>
              <PaymentStatusButton
                orderId={order.id}
                paymentStatus={order.paymentStatus}
                paymentMethod={order.paymentMethod}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
