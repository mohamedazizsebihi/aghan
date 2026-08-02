"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import type { PaymentMethod, PaymentStatus } from "@/generated/prisma/client";

export function PaymentStatusButton({
  orderId,
  paymentStatus,
  paymentMethod,
}: {
  orderId: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  if (paymentStatus === "PAID") return null;

  /**
   * Cash only. For a card order Stripe is the record of whether money moved, and
   * this button asserts otherwise — staff seeing a card order stuck UNPAID would
   * tidy it away with a click, booking revenue the customer was never charged
   * for, with no way back from the UI once the button disappeared.
   */
  if (paymentMethod !== "CASH") return null;

  async function markPaid() {
    setUpdating(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "PAID" }),
      });
      if (!res.ok) throw new Error("Could not update payment status");
      toast.success("Order marked as paid");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <button
      type="button"
      disabled={updating}
      onClick={markPaid}
      className="inline-flex items-center gap-1.5 rounded-full bg-green-800 px-3 py-1 text-xs font-medium text-cream transition-colors hover:bg-green-900 disabled:opacity-50"
    >
      <Check className="h-3.5 w-3.5" />
      {updating ? "Updating…" : "Mark as Paid"}
    </button>
  );
}
