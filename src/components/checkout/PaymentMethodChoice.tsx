"use client";

import { Banknote, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export function PaymentMethodChoice({
  value,
  onChange,
  cardEnabled,
  cardDisabledReason = "Online card payment is temporarily unavailable",
}: {
  value: "CASH" | "CARD";
  onChange: (value: "CASH" | "CARD") => void;
  cardEnabled: boolean;
  /** Why card is unavailable — Stripe not configured, or dine-in. */
  cardDisabledReason?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onChange("CASH")}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
          value === "CASH"
            ? "border-green-900 bg-green-900 text-cream shadow-md"
            : "border-ink/15 text-ink/60 hover:border-ink/30"
        )}
      >
        <Banknote className="h-4 w-4" />
        Cash
      </button>
      <button
        type="button"
        disabled={!cardEnabled}
        onClick={() => onChange("CARD")}
        title={cardEnabled ? undefined : cardDisabledReason}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
          value === "CARD"
            ? "border-green-900 bg-green-900 text-cream shadow-md"
            : "border-ink/15 text-ink/60 hover:border-ink/30"
        )}
      >
        <CreditCard className="h-4 w-4" />
        Card
      </button>
    </div>
  );
}
