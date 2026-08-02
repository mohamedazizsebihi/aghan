"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Leaf, Plus, View } from "lucide-react";
import { toast } from "sonner";
import { PatternPlaceholder } from "@/components/ui/PatternPlaceholder";
import { Badge } from "@/components/ui/Badge";
import { SpiceLevelBadge } from "@/components/menu/SpiceLevelBadge";
import { getCategoryIcon } from "@/lib/category-icons";
import { csvToList, formatPrice } from "@/lib/utils";
import { useCartStore } from "@/store/cart-store";
import type { DishWithCategory } from "@/types";

function getDietaryLabel(allergens: string) {
  const tags = csvToList(allergens).map((tag) => tag.toLowerCase());
  if (tags.includes("vegan")) return "Vegan";
  if (tags.includes("vegetarian")) return "Vegetarian";
  return null;
}

export function DishCard({ dish }: { dish: DishWithCategory }) {
  const addItem = useCartStore((s) => s.addItem);
  const dietaryLabel = getDietaryLabel(dish.allergens);

  function handleAddToOrder() {
    addItem({
      dishId: dish.id,
      slug: dish.slug,
      name: dish.name,
      price: dish.price,
      imageUrl: dish.imageUrl,
    });
    toast.success(`${dish.name} added to your order`);
  }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="flex h-full flex-col overflow-hidden rounded-2xl bg-white/60 shadow-sm ring-1 ring-ink/5 transition-shadow duration-300 hover:shadow-xl hover:shadow-ink/10"
    >
      <Link href={`/dish/${dish.slug}`} className="group relative block aspect-[4/3] w-full overflow-hidden">
        {dish.imageUrl ? (
          <Image
            src={dish.imageUrl}
            alt={dish.name}
            fill
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <PatternPlaceholder icon={getCategoryIcon(dish.category.slug)} />
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {dish.isPopular && (
            <Badge tone="gold" className="bg-cream/90">
              Popular
            </Badge>
          )}
          {dietaryLabel && (
            <Badge tone="green" className="gap-1 bg-cream/90">
              <Leaf className="h-3 w-3" /> {dietaryLabel}
            </Badge>
          )}
        </div>
        {dish.arModelGlbUrl && (
          <Badge tone="burgundy" className="absolute right-3 top-3 gap-1 bg-cream/90">
            <View className="h-3 w-3" /> AR
          </Badge>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/dish/${dish.slug}`}>
            <h3 className="font-display text-lg font-semibold text-ink transition-colors hover:text-burgundy-700">
              {dish.name}
            </h3>
          </Link>
          <SpiceLevelBadge level={dish.spiceLevel} className="mt-1.5 shrink-0" />
        </div>
        <p className="line-clamp-2 flex-1 text-sm text-ink/60">
          {dish.description}
        </p>
        <span className="font-display text-lg font-semibold text-burgundy-700">
          {formatPrice(dish.price)}
        </span>

        <div className="mt-1 flex items-center gap-2">
          <Link
            href={`/dish/${dish.slug}`}
            className="flex-1 rounded-full border border-ink/15 px-3 py-2 text-center text-xs font-medium text-ink/70 transition-colors hover:border-ink/30"
          >
            View Details
          </Link>
          <button
            aria-label={`Add ${dish.name} to order`}
            onClick={handleAddToOrder}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gold-500 px-3 py-2 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-gold-400"
          >
            <Plus className="h-3.5 w-3.5" /> Add to Order
          </button>
        </div>
      </div>
    </motion.div>
  );
}
