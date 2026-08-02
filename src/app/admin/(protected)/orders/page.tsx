import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { formatPrice, cn } from "@/lib/utils";
import { fulfillmentLabel, orderCustomerLabel } from "@/lib/constants";
import { OrdersLiveFeed } from "@/components/admin/OrdersLiveFeed";
import type { OrderStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

/** A service's worth of orders, not a year's. */
const RECENT_ORDER_LIMIT = 100;

const STATUS_FILTERS: (OrderStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "COMPLETED",
  "CANCELLED",
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus =
    status && STATUS_FILTERS.includes(status as OrderStatus) ? status : "ALL";

  /**
   * Capped, because this is the page the kitchen leaves open all service and it
   * re-renders on every live order event. Unbounded, it re-read and re-serialised
   * the entire order history into the RSC payload each time a new order came in —
   * the cost of which grows for ever while the useful part stays at the top.
   */
  const orders = await prisma.order.findMany({
    where: activeStatus === "ALL" ? undefined : { status: activeStatus as OrderStatus },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: RECENT_ORDER_LIMIT,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-ink">Orders</h1>
        {/* Ids in render order, so the feed can tell which rows just arrived. */}
        <OrdersLiveFeed orderIds={orders.map((order) => order.id)} />
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={s === "ALL" ? "/admin/orders" : `/admin/orders?status=${s}`}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              activeStatus === s
                ? "bg-green-900 text-cream"
                : "bg-white text-ink/60 ring-1 ring-ink/10 hover:bg-ink/5"
            )}
          >
            {s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white px-6 py-10 text-center text-ink/40 shadow-sm ring-1 ring-ink/5">
          No orders in this view.
        </p>
      ) : (
        <>
          {/* Mobile / tablet-portrait: stacked cards instead of a cramped table */}
          <div className="mt-6 divide-y divide-ink/5 rounded-2xl bg-white shadow-sm ring-1 ring-ink/5 md:hidden">
            {orders.map((order) => (
              <Link
                key={order.id}
                data-order-id={order.id}
                href={`/admin/orders/${order.id}`}
                className="block px-5 py-4 transition-colors hover:bg-ink/[0.02]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-burgundy-700">
                    {order.orderNumber}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="mt-1 text-sm text-ink/70">
                  {orderCustomerLabel(order)}
                </p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span
                    className={cn(
                      order.fulfillmentType === "DINE_IN"
                        ? "font-medium text-green-800"
                        : "text-ink/50"
                    )}
                  >
                    {fulfillmentLabel(order.fulfillmentType, order.tableNumber)}
                  </span>
                  <span className="font-medium text-ink">
                    {formatPrice(order.total)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink/40">
                  {order.createdAt.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </Link>
            ))}
          </div>

          {/* Tablet-landscape / desktop: full table */}
          <div className="mt-6 hidden overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink/5 md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-ink/5 bg-ink/[0.02] text-xs uppercase tracking-wider text-ink/45">
                <tr>
                  <th className="px-6 py-3">Order</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Total</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    data-order-id={order.id}
                    className="transition-colors hover:bg-ink/[0.02]"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-burgundy-700 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-ink/70">
                      {orderCustomerLabel(order)}
                    </td>
                    <td
                      className={cn(
                        "px-6 py-4",
                        order.fulfillmentType === "DINE_IN"
                          ? "font-medium text-green-800"
                          : "text-ink/60"
                      )}
                    >
                      {fulfillmentLabel(order.fulfillmentType, order.tableNumber)}
                    </td>
                    <td className="px-6 py-4 font-medium text-ink">
                      {formatPrice(order.total)}
                    </td>
                    <td className="px-6 py-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-4 text-ink/50">
                      {order.createdAt.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
