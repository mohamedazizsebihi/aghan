"use client";

import { useEffect } from "react";
import { Check, CircleDashed, Radio, XCircle } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { fulfillmentLabel } from "@/lib/constants";
import {
  currentStepIndex,
  isCancelled,
  isFinished,
  trackingSteps,
  type TrackedOrder,
} from "@/lib/order-tracking";
import { useOrderTracking } from "@/hooks/use-order-tracking";
import { useMyOrdersStore } from "@/store/my-orders-store";

/**
 * Live status of one order, as the customer sees it.
 *
 * Seeded with a projection rendered on the server so the first paint already
 * shows the truth, then kept current by the stream.
 */
export function OrderTracker({
  orderId,
  initialOrder,
}: {
  orderId: string;
  initialOrder: TrackedOrder;
}) {
  const { order, live, gone } = useOrderTracking(orderId, initialOrder);
  const forget = useMyOrdersStore((s) => s.forget);
  const current = order ?? initialOrder;
  const completed = current.status === "COMPLETED";

  /**
   * Drop a served order from this device as soon as the stream says so, rather
   * than waiting for the customer to open the list again. The page itself is
   * unaffected — it reads the order from the server by id, not from the store —
   * so this link keeps working if it was bookmarked or shared.
   */
  useEffect(() => {
    if (completed) forget(current.id);
  }, [completed, current.id, forget]);

  if (gone) {
    return (
      <p className="rounded-2xl bg-white/60 px-6 py-8 text-center text-sm text-ink/50 ring-1 ring-ink/5">
        This order is no longer available. Please ask a member of staff.
      </p>
    );
  }

  const cancelled = isCancelled(current.status);
  const steps = trackingSteps(current.fulfillmentType);
  const activeIndex = currentStepIndex(current.fulfillmentType, current.status);

  return (
    <div className="rounded-2xl bg-white/60 p-6 ring-1 ring-ink/5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
        <div>
          <p className="font-display text-lg font-semibold text-ink">
            {current.orderNumber}
          </p>
          <p className="text-sm text-ink/50">
            {fulfillmentLabel(current.fulfillmentType, current.tableNumber)}
          </p>
        </div>
        {live && !isFinished(current.status) && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-800/10 px-3 py-1 text-xs font-medium text-green-800">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            Live
          </span>
        )}
      </div>

      {cancelled ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl bg-burgundy-800/10 px-4 py-3 text-sm text-burgundy-800">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-medium">This order was cancelled.</span> If you
            weren&rsquo;t expecting that, please ask a member of staff.
          </p>
        </div>
      ) : (
        <ol className="mt-5 space-y-1">
          {steps.map((step, index) => {
            // activeIndex is -1 when staff put the order into a status this
            // fulfillment type has no stage for; nothing is then marked current.
            const done = activeIndex > index;
            const isCurrent = activeIndex === index;
            return (
              <li key={step.label} className="flex items-center gap-3 py-1.5">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    done && "bg-green-800 text-cream",
                    isCurrent && "bg-gold-500 text-ink",
                    !done && !isCurrent && "bg-ink/8 text-ink/30"
                  )}
                >
                  {done ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <CircleDashed
                      className={cn("h-4 w-4", isCurrent && "animate-pulse")}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    isCurrent
                      ? "font-semibold text-ink"
                      : done
                        ? "text-ink/60"
                        : "text-ink/35"
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {activeIndex === -1 && !cancelled && (
        <p className="mt-3 text-xs text-ink/45">
          Your order is with our staff — ask anyone if you need an update.
        </p>
      )}

      {/* Says why it will not be in "My Orders" any more, so it doesn't just
          quietly vanish from the list behind them. */}
      {completed && (
        <p className="mt-4 rounded-xl bg-green-900/10 px-4 py-3 text-sm text-green-800">
          All done — enjoy! This order has been cleared from{" "}
          <span className="font-medium">My Orders</span>. This page still works
          if you keep the link.
        </p>
      )}

      <div className="mt-5 space-y-2 border-t border-ink/10 pt-4">
        {current.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm text-ink/70">
            <span>
              {item.quantity} × {item.nameSnapshot}
            </span>
            <span>{formatPrice(item.priceSnapshot * item.quantity)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-ink/10 pt-3 font-display text-lg font-semibold text-ink">
          <span>Total</span>
          <span>{formatPrice(current.total)}</span>
        </div>
      </div>
    </div>
  );
}
