"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ReceiptText } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { useHydrated } from "@/hooks/use-hydrated";
import { useMyOrdersStore } from "@/store/my-orders-store";
import { cn, formatPrice } from "@/lib/utils";
import { fulfillmentLabel } from "@/lib/constants";
import {
  currentStepIndex,
  isCancelled,
  trackingSteps,
  type TrackedOrder,
} from "@/lib/order-tracking";

/**
 * What we know about a remembered order after asking the server.
 *
 * "gone" is reserved for an actual 404. A fetch that simply failed — the phone
 * lost signal walking to the counter — must stay `undefined` and be retried,
 * not be reported to the customer as an order that no longer exists.
 */
type Lookup = TrackedOrder | "gone" | undefined;

/**
 * The orders this device has placed.
 *
 * Each is fetched once for its summary — a stream per row would hold a socket
 * open for every order in the list, which is what the tracking page is for.
 * Opening a row is what goes live.
 */
export function MyOrdersList() {
  const hydrated = useHydrated();
  const remembered = useMyOrdersStore((s) => s.orders);
  const forget = useMyOrdersStore((s) => s.forget);
  const [lookups, setLookups] = useState<Record<string, Lookup>>({});

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    Promise.all(
      remembered.map(async (entry) => {
        const res = await fetch(`/api/orders/${entry.id}/status`, {
          cache: "no-store",
        }).catch(() => null);

        if (res?.status === 404) return [entry.id, "gone" as const] as const;
        if (!res?.ok) return [entry.id, undefined] as const;

        const data = await res.json().catch(() => null);
        return [entry.id, (data?.order ?? undefined) as Lookup] as const;
      })
    ).then((entries) => {
      if (cancelled) return;
      setLookups(Object.fromEntries(entries));

      /**
       * A served order has nothing left to follow, so it is dropped from this
       * device rather than left to pile up — the customer's phone is not an
       * order history.
       *
       * Only on COMPLETED, and only on a positive answer from the server.
       * Cancelled orders stay: a customer who finds an order missing with no
       * explanation is worse off than one who sees it was cancelled. The store's
       * own cap bounds those.
       */
      for (const [id, lookup] of entries) {
        if (lookup && lookup !== "gone" && lookup.status === "COMPLETED") {
          forget(id);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [hydrated, remembered, forget]);

  if (!hydrated) return null;

  // Hide anything already known to be finished, so a served order never flashes
  // on screen in the moment between the lookup landing and the store updating.
  const visible = remembered.filter((entry) => {
    const lookup = lookups[entry.id];
    return !(lookup && lookup !== "gone" && lookup.status === "COMPLETED");
  });

  if (visible.length === 0) {
    return (
      <div className="rounded-2xl bg-white/60 px-6 py-12 text-center ring-1 ring-ink/5">
        <ReceiptText className="mx-auto h-8 w-8 text-ink/25" />
        <p className="mt-3 font-display text-lg font-semibold text-ink">
          No orders in progress
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink/50">
          Orders you place on this phone appear here while they&rsquo;re being
          prepared, and clear themselves once they&rsquo;re done.
        </p>
        <LinkButton href="/menu" className="mt-6">
          Browse the menu
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visible.map((entry) => {
        const lookup = lookups[entry.id];

        if (lookup === "gone") {
          return (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-4 rounded-2xl bg-white/40 px-5 py-4 ring-1 ring-ink/5"
            >
              <div>
                <p className="font-medium text-ink/60">{entry.orderNumber}</p>
                <p className="text-sm text-ink/40">No longer available</p>
              </div>
              <button
                onClick={() => forget(entry.id)}
                className="text-sm text-ink/45 underline-offset-2 hover:text-ink hover:underline"
              >
                Remove
              </button>
            </div>
          );
        }

        const order = lookup;
        const steps = order ? trackingSteps(order.fulfillmentType) : [];
        const index = order
          ? currentStepIndex(order.fulfillmentType, order.status)
          : -1;
        const cancelled = order ? isCancelled(order.status) : false;
        const stage = cancelled
          ? "Cancelled"
          : (steps[index]?.label ?? "In progress");

        return (
          <Link
            key={entry.id}
            href={`/orders/${entry.id}`}
            className="flex items-center justify-between gap-4 rounded-2xl bg-white/60 px-5 py-4 ring-1 ring-ink/5 transition-colors hover:bg-white"
          >
            <div className="min-w-0">
              <p className="font-medium text-ink">{entry.orderNumber}</p>
              <p className="truncate text-sm text-ink/50">
                {order
                  ? fulfillmentLabel(order.fulfillmentType, order.tableNumber)
                  : "Loading…"}
              </p>
              {order && (
                <p
                  className={cn(
                    "mt-0.5 text-sm font-medium",
                    cancelled ? "text-burgundy-700" : "text-green-800"
                  )}
                >
                  {stage}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {order && (
                <span className="font-medium text-ink">
                  {formatPrice(order.total)}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-ink/30" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
