"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The orders this phone has placed.
 *
 * A cash dine-in order carries no name, email or phone by design, so there is
 * nothing to look an order up by — the device that placed it is the only thing
 * that knows. Keeping the ids next to the cart is what lets a customer close
 * the tab, lock their phone, and still come back to "where is my food".
 *
 * Ids only. Everything shown comes from the tracking endpoint, so a stale entry
 * can never contradict the kitchen.
 */

/** Enough for a long visit; old entries are dropped rather than kept forever. */
const MAX_REMEMBERED = 20;

export type RememberedOrder = {
  id: string;
  orderNumber: string;
  placedAt: number;
};

type MyOrdersState = {
  orders: RememberedOrder[];
  remember: (order: { id: string; orderNumber: string }) => void;
  forget: (id: string) => void;
};

export const useMyOrdersStore = create<MyOrdersState>()(
  persist(
    (set) => ({
      orders: [],
      remember: ({ id, orderNumber }) =>
        set((state) => ({
          orders: [
            { id, orderNumber, placedAt: Date.now() },
            // Re-placing the same order id must not duplicate the entry, which
            // happens when the confirmation page is reloaded.
            ...state.orders.filter((order) => order.id !== id),
          ].slice(0, MAX_REMEMBERED),
        })),
      forget: (id) =>
        set((state) => ({ orders: state.orders.filter((o) => o.id !== id) })),
    }),
    { name: "bagh-e-kabul-my-orders" }
  )
);
