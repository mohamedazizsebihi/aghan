"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FulfillmentType, OrderStatus } from "@/generated/prisma/client";
import { allowedNext, isTerminal } from "@/lib/order-state";

export function OrderStatusSelect({
  orderId,
  status,
  fulfillmentType,
}: {
  orderId: string;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  // Only the moves that are actually legal from here, so the dropdown and the
  // server agree instead of the server rejecting what the UI just offered.
  const options = [status, ...allowedNext(status, fulfillmentType)];
  const finished = isTerminal(status);

  async function handleChange(next: OrderStatus) {
    if (
      next === "CANCELLED" &&
      !window.confirm("Cancel this order? This cannot be undone.")
    ) {
      return;
    }
    setUpdating(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Could not update status");
      toast.success("Order status updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <select
      value={status}
      disabled={updating || finished}
      onChange={(e) => handleChange(e.target.value as OrderStatus)}
      title={finished ? `This order is ${status.toLowerCase()}.` : undefined}
      className="rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm font-medium text-ink outline-none focus:border-green-800 disabled:opacity-50"
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {s.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}
