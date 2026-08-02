"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, X } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { Button } from "@/components/ui/Button";
import CartLineItem from "@/components/cart/CartLineItem";

export default function CartDrawer() {
  const router = useRouter();
  const hydrated = useHydrated();
  const isOpen = useCartStore((s) => s.isOpen);
  const close = useCartStore((s) => s.close);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-cream shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-ink/10 px-6 py-5">
              <h2 className="font-display text-xl font-semibold text-ink">
                Your Order
              </h2>
              <button
                aria-label="Close cart"
                onClick={close}
                className="rounded-full p-2 text-ink/60 hover:bg-ink/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!hydrated || items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <ShoppingBag className="h-10 w-10 text-ink/20" />
                <p className="text-ink/50">Your cart is empty.</p>
                <Button variant="secondary" onClick={close}>
                  Browse the Menu
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1 divide-y divide-ink/5 overflow-y-auto px-6">
                  {items.map((item) => (
                    <CartLineItem key={item.dishId} item={item} />
                  ))}
                </div>

                <div className="border-t border-ink/10 px-6 py-5">
                  <div className="mb-4 flex items-center justify-between text-base font-semibold text-ink">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      close();
                      router.push("/checkout");
                    }}
                  >
                    Proceed to Checkout
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
