"use client";

import { useEffect } from "react";
import { useMyOrdersStore } from "@/store/my-orders-store";

/**
 * Records an order on this device so it shows up under "My Orders".
 *
 * Renders nothing. Placed on both the confirmation page and the tracking page,
 * because a customer who opens a tracking link on another device should find it
 * there too, and because the confirmation page is the only moment we are
 * certain an order was just placed.
 */
export function RememberOrder({
  id,
  orderNumber,
}: {
  id: string;
  orderNumber: string;
}) {
  const remember = useMyOrdersStore((s) => s.remember);

  useEffect(() => {
    remember({ id, orderNumber });
  }, [id, orderNumber, remember]);

  return null;
}
