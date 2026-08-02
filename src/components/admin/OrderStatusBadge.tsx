import { Badge } from "@/components/ui/Badge";
import type { OrderStatus } from "@/generated/prisma/client";

const TONE: Record<OrderStatus, "gold" | "green" | "burgundy" | "neutral"> = {
  PENDING: "gold",
  CONFIRMED: "green",
  PREPARING: "green",
  READY: "green",
  OUT_FOR_DELIVERY: "green",
  COMPLETED: "neutral",
  CANCELLED: "burgundy",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={TONE[status]}>{status.replace(/_/g, " ")}</Badge>
  );
}
