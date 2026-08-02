"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Remembers which table's QR code the customer scanned.
 *
 * The scan lands on `/menu?table=5`, but the order is placed several
 * navigations later (menu → dish → cart → checkout), by which point the query
 * parameter is long gone. Persisting it alongside the cart is what carries the
 * table through to checkout — and through a page reload, which is common when
 * a phone locks mid-meal.
 */

/**
 * How long a scan stays in effect.
 *
 * Without an expiry, a customer who scanned a table on Friday and ordered
 * delivery from home on Sunday would have that order silently filed as dine-in
 * at table 5 — the kitchen would plate it for a table nobody is sitting at.
 * Three hours comfortably covers a long meal and is well short of a return
 * visit.
 */
const TABLE_SESSION_TTL_MS = 3 * 60 * 60 * 1000;

export type TableSession = {
  tableNumber: number;
  /** Epoch ms of the scan; refreshed each time the code is scanned again. */
  startedAt: number;
};

type TableSessionState = {
  session: TableSession | null;
  startSession: (tableNumber: number) => void;
  clearSession: () => void;
};

export const useTableSessionStore = create<TableSessionState>()(
  persist(
    (set) => ({
      session: null,
      startSession: (tableNumber) =>
        set({ session: { tableNumber, startedAt: Date.now() } }),
      clearSession: () => set({ session: null }),
    }),
    { name: "bagh-e-kabul-table" }
  )
);

/**
 * The table currently in effect, or null if there is none or it has lapsed.
 *
 * Kept as a plain function of (session, now) rather than a selector so the
 * expiry can be tested without a store, and so callers decide when "now" is
 * read — evaluating `Date.now()` during a server render would disagree with the
 * client and trip a hydration mismatch.
 */
export function activeTableNumber(
  session: TableSession | null,
  now: number = Date.now()
): number | null {
  if (!session) return null;
  if (now - session.startedAt > TABLE_SESSION_TTL_MS) return null;
  return session.tableNumber;
}
