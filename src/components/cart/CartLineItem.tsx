"use client";

import Image from "next/image";
import { Minus, Plus, Trash2 } from "lucide-react";
import { PatternPlaceholder } from "@/components/ui/PatternPlaceholder";
import { formatPrice } from "@/lib/utils";
import { useCartStore, type CartItem } from "@/store/cart-store";

export default function CartLineItem({ item }: { item: CartItem }) {
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  return (
    <div className="flex gap-4 py-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <PatternPlaceholder />
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-base font-semibold text-ink">
            {item.name}
          </p>
          <button
            aria-label={`Remove ${item.name}`}
            onClick={() => removeItem(item.dishId)}
            className="text-ink/30 transition-colors hover:text-burgundy-700"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-ink/50">{formatPrice(item.price)}</p>

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-3 rounded-full border border-ink/10 px-2 py-1">
            <button
              aria-label="Decrease quantity"
              onClick={() => setQuantity(item.dishId, item.quantity - 1)}
              className="text-ink/60 hover:text-ink"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-4 text-center text-sm font-medium">
              {item.quantity}
            </span>
            <button
              aria-label="Increase quantity"
              onClick={() => setQuantity(item.dishId, item.quantity + 1)}
              className="text-ink/60 hover:text-ink"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="font-semibold text-ink">
            {formatPrice(item.price * item.quantity)}
          </p>
        </div>
      </div>
    </div>
  );
}
