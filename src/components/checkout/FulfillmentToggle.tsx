"use client";

import { Bike, Store, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

export type FulfillmentChoice = "DELIVERY" | "PICKUP" | "DINE_IN";

/**
 * Fulfillment picker. Dine-in only appears when the customer actually scanned a
 * table's QR code — a dine-in order without a table number is one the kitchen
 * can't deliver, and the schema rejects it anyway, so offering the choice to
 * someone ordering from home would only produce a dead end.
 */
export function FulfillmentToggle({
  value,
  onChange,
  tableNumber,
}: {
  value: FulfillmentChoice;
  onChange: (value: FulfillmentChoice) => void;
  tableNumber: number | null;
}) {
  const dineInAvailable = tableNumber !== null;

  const options = [
    ...(dineInAvailable
      ? [
          {
            value: "DINE_IN" as const,
            label: "Dine-in",
            hint: `Table ${tableNumber}`,
            icon: UtensilsCrossed,
          },
        ]
      : []),
    { value: "DELIVERY" as const, label: "Delivery", hint: null, icon: Bike },
    { value: "PICKUP" as const, label: "Pickup", hint: null, icon: Store },
  ];

  return (
    <div
      className={cn(
        "grid gap-3",
        // Written out rather than interpolated so Tailwind can see both.
        dineInAvailable ? "grid-cols-3" : "grid-cols-2"
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center text-sm font-medium transition-all sm:px-4",
              active
                ? "border-green-900 bg-green-900 text-cream shadow-md"
                : "border-ink/15 text-ink/60 hover:border-ink/30"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{opt.label}</span>
            {opt.hint && (
              <span
                className={cn(
                  "text-[0.7rem] font-normal",
                  active ? "text-cream/70" : "text-ink/40"
                )}
              >
                {opt.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
