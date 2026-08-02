"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { formatPrice } from "@/lib/utils";

export type SearchableDish = {
  slug: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  categoryName: string;
};

export function MenuSearch({ dishes }: { dishes: SearchableDish[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return dishes
      .filter(
        (dish) =>
          dish.name.toLowerCase().includes(q) ||
          dish.description.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, dishes]);

  const showDropdown = query.trim().length >= 2;

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a dish…"
          className="w-full rounded-full border border-ink/10 bg-white/80 py-3 pl-11 pr-10 text-sm text-ink shadow-sm outline-none ring-gold-500/40 backdrop-blur-sm transition-shadow focus:ring-2"
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

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 top-full z-40 mt-2 max-h-80 overflow-y-auto rounded-2xl bg-white p-2 shadow-xl ring-1 ring-ink/10"
          >
            {results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink/45">
                No dishes match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              results.map((dish) => (
                <Link
                  key={dish.slug}
                  href={`/dish/${dish.slug}`}
                  className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-cream"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink/5">
                    {dish.imageUrl && (
                      <Image src={dish.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{dish.name}</p>
                    <p className="truncate text-xs text-ink/45">{dish.categoryName}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-burgundy-700">
                    {formatPrice(dish.price)}
                  </span>
                </Link>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
