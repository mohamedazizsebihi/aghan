import Link from "next/link";
import { ClipboardList, DollarSign, UtensilsCrossed, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/StatCard";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { formatPrice } from "@/lib/utils";
import { orderCustomerLabel } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [todayOrders, pendingOrders, dishCount, recentOrders, revenueAgg] =
    await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
      // Excludes abandoned card checkouts (created but never paid) — those
      // aren't real kitchen work, just noise from customers who bailed at
      // the Stripe step.
      prisma.order.count({
        where: {
          status: "PENDING",
          NOT: { paymentMethod: "CARD", paymentStatus: "UNPAID" },
        },
      }),
      prisma.dish.count(),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { items: true },
      }),
      // Revenue only counts money actually collected — cash orders count
      // once marked Paid, card orders once Stripe confirms payment. Cancelled
      // ones are excluded even when paid: that money is owed back, and counting
      // it inflated the day's takings until someone remembered to mark the
      // refund by hand.
      prisma.order.aggregate({
        where: {
          createdAt: { gte: startOfToday },
          paymentStatus: "PAID",
          status: { not: "CANCELLED" },
        },
        _sum: { total: true },
      }),
    ]);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">Dashboard</h1>
      <p className="mt-1 text-sm text-ink/50">
        A quick overview of today&rsquo;s activity.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Orders Today"
          value={String(todayOrders)}
          icon={ClipboardList}
        />
        <StatCard
          label="Revenue Today"
          value={formatPrice(revenueAgg._sum.total ?? 0)}
          icon={DollarSign}
        />
        <StatCard
          label="Pending Orders"
          value={String(pendingOrders)}
          icon={Clock}
        />
        <StatCard label="Menu Items" value={String(dishCount)} icon={UtensilsCrossed} />
      </div>

      <div className="mt-10 rounded-2xl bg-white shadow-sm ring-1 ring-ink/5">
        <div className="flex items-center justify-between border-b border-ink/5 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">
            Recent Orders
          </h2>
          <Link
            href="/admin/orders"
            className="text-sm font-medium text-burgundy-700 hover:underline"
          >
            View All
          </Link>
        </div>
        <div className="divide-y divide-ink/5">
          {recentOrders.length === 0 && (
            <p className="px-6 py-8 text-center text-sm text-ink/40">
              No orders yet.
            </p>
          )}
          {recentOrders.map((order) => (
            <Link
              key={order.id}
              href={`/admin/orders/${order.id}`}
              className="flex items-center justify-between px-6 py-4 text-sm transition-colors hover:bg-ink/[0.02]"
            >
              <div>
                <p className="font-medium text-ink">{order.orderNumber}</p>
                <p className="text-ink/45">
                  {orderCustomerLabel(order)} · {order.items.length} item(s)
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium text-ink">
                  {formatPrice(order.total)}
                </span>
                <OrderStatusBadge status={order.status} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
