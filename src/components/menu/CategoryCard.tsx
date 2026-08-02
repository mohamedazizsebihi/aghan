"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { PatternPlaceholder } from "@/components/ui/PatternPlaceholder";
import { getCategoryIcon } from "@/lib/category-icons";

export function CategoryCard({
  slug,
  name,
  imageUrl,
  dishCount,
}: {
  slug: string;
  name: string;
  imageUrl: string | null;
  dishCount: number;
}) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.3 }}>
      <Link
        href={`/menu/${slug}`}
        className="group relative flex h-48 items-end overflow-hidden rounded-3xl shadow-sm ring-1 ring-ink/10 transition-shadow duration-300 hover:shadow-xl hover:shadow-ink/15 sm:h-56"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <PatternPlaceholder icon={getCategoryIcon(slug)} className="absolute inset-0" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />

        <div className="relative flex w-full items-end justify-between gap-3 p-5">
          <div>
            <h3 className="font-display text-xl font-bold text-cream sm:text-2xl">
              {name}
            </h3>
            <p className="mt-1 text-xs uppercase tracking-wider text-gold-400">
              {dishCount} {dishCount === 1 ? "dish" : "dishes"}
            </p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500 text-ink transition-transform duration-300 group-hover:translate-x-0.5">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
