"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  dishId: string;
  slug: string;
  name: string;
  price: number;
  imageUrl: string | null;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (dishId: string) => void;
  setQuantity: (dishId: string, quantity: number) => void;
  clear: () => void;
  totalItems: () => number;
  subtotal: () => number;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      addItem: (item, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.dishId === item.dishId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.dishId === item.dishId
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity }] };
        });
      },
      removeItem: (dishId) => {
        set((state) => ({
          items: state.items.filter((i) => i.dishId !== dishId),
        }));
      },
      setQuantity: (dishId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(dishId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.dishId === dishId ? { ...i, quantity } : i
          ),
        }));
      },
      clear: () => set({ items: [] }),
      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: "bagh-e-kabul-cart",
      partialize: (state) => ({ items: state.items }),
    }
  )
);
