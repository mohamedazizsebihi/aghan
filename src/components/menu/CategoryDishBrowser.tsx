"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { DishCard } from "@/components/menu/DishCard";
import type { DishWithCategory } from "@/types";

export function CategoryDishBrowser({ dishes }: { dishes: DishWithCategory[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dishes;
    return dishes.filter(
      (dish) =>
        dish.name.toLowerCase().includes(q) ||
        dish.description.toLowerCase().includes(q)
    );
  }, [query, dishes]);

  return (
    <div>
      <div className="relative mx-auto w-full max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this category…"
          className="w-full rounded-full border border-ink/10 bg-white/80 py-2.5 pl-11 pr-10 text-sm text-ink shadow-sm outline-none ring-gold-500/40 backdrop-blur-sm transition-shadow focus:ring-2"
        />
        {query && (
          <button
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink/40 hover:bg-ink/5"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={query}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-16 text-center text-ink/50">
              No dishes match your search.
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
