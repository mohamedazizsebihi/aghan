"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { QuantitySelector } from "@/components/dish/QuantitySelector";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import type { Dish } from "@/generated/prisma/client";

export function AddToCartButton({ dish }: { dish: Dish }) {
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.open);

  function handleAdd() {
    addItem(
      {
        dishId: dish.id,
        slug: dish.slug,
        name: dish.name,
        price: dish.price,
        imageUrl: dish.imageUrl,
      },
      quantity
    );
    toast.success(`${quantity} × ${dish.name} added to your order`);
    openCart();
    setQuantity(1);
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <QuantitySelector value={quantity} onChange={setQuantity} />
      <motion.div whileTap={{ scale: 0.96 }}>
        <Button size="lg" onClick={handleAdd} className="min-w-[220px]">
          Add to Order — {formatPrice(dish.price * quantity)}
        </Button>
      </motion.div>
    </div>
  );
}
