"use client";

import { ShoppingBag } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import CartLineItem from "@/components/cart/CartLineItem";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import { useHydrated } from "@/hooks/use-hydrated";

export default function CartPage() {
  const hydrated = useHydrated();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());

  return (
    <div className="mx-auto min-h-[60vh] max-w-3xl px-5 py-14 sm:px-8">
      <h1 className="font-display text-4xl font-bold text-ink">Your Order</h1>

      {!hydrated || items.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <ShoppingBag className="h-12 w-12 text-ink/20" />
          <p className="text-ink/50">Your cart is currently empty.</p>
          <LinkButton href="/menu">Browse the Menu</LinkButton>
        </div>
      ) : (
        <>
          <div className="mt-8 divide-y divide-ink/5 rounded-2xl bg-white/60 px-6 ring-1 ring-ink/5">
            {items.map((item) => (
              <CartLineItem key={item.dishId} item={item} />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between rounded-2xl bg-green-950 px-6 py-5 text-cream">
            <span className="font-display text-xl font-semibold">Subtotal</span>
            <span className="font-display text-xl font-semibold">
              {formatPrice(subtotal)}
            </span>
          </div>

          <div className="mt-8 flex justify-end">
            <LinkButton href="/checkout" size="lg">
              Proceed to Checkout
            </LinkButton>
          </div>
        </>
      )}
    </div>
  );
}
