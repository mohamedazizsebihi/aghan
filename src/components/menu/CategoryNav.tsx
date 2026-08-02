"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/category-icons";
import type { Category } from "@/generated/prisma/client";

export function CategoryNav({
  categories,
  active,
}: {
  categories: Category[];
  active: string;
}) {
  return (
    <div className="sticky top-[73px] z-30 -mx-5 overflow-x-auto border-b border-ink/10 bg-cream/95 px-5 py-4 backdrop-blur-md sm:mx-0 sm:rounded-full sm:border sm:px-2 sm:py-2 sm:shadow-sm">
      <div className="flex w-max gap-2 sm:w-full sm:flex-wrap sm:justify-center">
        {categories.map((category) => {
          const Icon = getCategoryIcon(category.slug);
          const isActive = active === category.slug;
          return (
            <Link
              key={category.id}
              href={`/menu/${category.slug}`}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-green-900 text-cream"
                  : "text-ink/60 hover:bg-ink/5"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-gold-400" : "text-ink/40")} />
              {category.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
