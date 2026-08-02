"use client";

import { useEffect } from "react";
import { useTableSessionStore } from "@/store/table-session-store";

/**
 * Turns the `?table=N` a QR code lands on into a stored table session.
 *
 * Renders nothing — it exists purely so the menu page, a Server Component, can
 * hand the parsed table number across the client boundary and have it written
 * to localStorage where the rest of the ordering flow can find it.
 */
export function TableSessionCapture({ tableNumber }: { tableNumber: number }) {
  const startSession = useTableSessionStore((s) => s.startSession);

  useEffect(() => {
    // Re-scanning restarts the clock, so a long meal never expires under way.
    startSession(tableNumber);
  }, [tableNumber, startSession]);

  return null;
}
