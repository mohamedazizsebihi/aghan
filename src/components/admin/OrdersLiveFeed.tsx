"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrderAlertSound } from "@/hooks/use-order-alert-sound";

/** How long a newly arrived row stays highlighted. */
const HIGHLIGHT_MS = 8000;

/**
 * A burst of orders at the start of service should cost one re-render, not one
 * per order. Short enough that nobody perceives a delay.
 */
const REFRESH_DEBOUNCE_MS = 250;

/**
 * Keeps the admin order list current without anyone refreshing.
 *
 * The stream only ever says "something changed"; this asks the server for the
 * list again. That is what lets the page stay a Server Component — sorting,
 * filtering and row markup exist once, and cannot drift from a client-side copy.
 *
 * Which rows are *new* is the part the server cannot answer, since it has no
 * idea what this screen was already showing. So the ids rendered are passed
 * down on every render and diffed here: anything that was not in the previous
 * set arrived just now, and gets highlighted and announced.
 */
export function OrdersLiveFeed({ orderIds }: { orderIds: string[] }) {
  const router = useRouter();
  const { enabled: soundOn, toggle: toggleSound, play } = useOrderAlertSound();
  const [connected, setConnected] = useState(false);

  const seenRef = useRef<Set<string> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Diff on every render of the list. The first pass seeds the set instead of
  // treating the whole page as new — nobody wants twenty rows flashing and a
  // chime on arrival.
  useEffect(() => {
    if (seenRef.current === null) {
      seenRef.current = new Set(orderIds);
      return;
    }

    const seen = seenRef.current;
    const arrived = orderIds.filter((id) => !seen.has(id));
    for (const id of orderIds) seen.add(id);
    if (arrived.length === 0) return;

    play();

    /**
     * The rows are server-rendered, so the highlight is applied to the DOM
     * rather than through React state. Wrapping every row in a client component
     * purely to flash it would pull the whole table into the client bundle for
     * a background colour.
     */
    const timers = arrived.map((id) => {
      const row = document.querySelector<HTMLElement>(`[data-order-id="${id}"]`);
      row?.classList.add("order-row-new");
      return setTimeout(
        () => row?.classList.remove("order-row-new"),
        HIGHLIGHT_MS
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [orderIds, play]);

  useEffect(() => {
    const source = new EventSource("/api/admin/orders/stream");

    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    };

    source.addEventListener("ready", () => setConnected(true));
    source.addEventListener("changed", scheduleRefresh);
    // EventSource reconnects by itself; reflect that we are not live meanwhile.
    source.addEventListener("error", () => setConnected(false));

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      source.close();
    };
  }, [router]);

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
          connected
            ? "bg-green-800/10 text-green-800"
            : "bg-ink/5 text-ink/45"
        )}
        title={
          connected
            ? "New orders appear here by themselves"
            : "Reconnecting — the list may be a moment behind"
        }
      >
        <Radio className={cn("h-3.5 w-3.5", connected && "animate-pulse")} />
        {connected ? "Live" : "Reconnecting…"}
      </span>

      <button
        onClick={toggleSound}
        title={
          soundOn
            ? "Turn off the new-order chime"
            : "Play a chime when an order arrives"
        }
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
          soundOn
            ? "bg-gold-500/20 text-brown-800 hover:bg-gold-500/30"
            : "bg-ink/5 text-ink/45 hover:bg-ink/10"
        )}
      >
        {soundOn ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
        {soundOn ? "Sound on" : "Sound off"}
      </button>
    </div>
  );
}
