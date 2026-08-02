import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CategoryNav } from "@/components/menu/CategoryNav";
import { CategoryDishBrowser } from "@/components/menu/CategoryDishBrowser";
import { PatternPlaceholder } from "@/components/ui/PatternPlaceholder";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { getCategoryIcon } from "@/lib/category-icons";

export const dynamic = "force-dynamic";

async function getCategory(slug: string) {
  return prisma.category.findUnique({ where: { slug } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = await getCategory(categorySlug);
  if (!category) return { title: "Menu | Bagh-e-Kabul" };
  return {
    title: `${category.name} | Bagh-e-Kabul Menu`,
    description: `Browse our ${category.name} dishes — authentic Afghan recipes made fresh.`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const { categorySlug } = await params;

  const [allCategories, category] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    getCategory(categorySlug),
  ]);

  if (!category) notFound();

  const dishes = await prisma.dish.findMany({
    where: { categoryId: category.id, isAvailable: true },
    include: { category: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="bg-cream">
      <div className="relative flex h-56 items-end overflow-hidden bg-green-950 text-cream sm:h-72">
        {category.imageUrl ? (
          <Image
            src={category.imageUrl}
            alt={category.name}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <PatternPlaceholder icon={getCategoryIcon(category.slug)} className="absolute inset-0" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-green-950 via-green-950/50 to-transparent" />

        <div className="relative mx-auto w-full max-w-6xl px-5 pb-6 sm:px-8">
          <Link
            href="/menu"
            className="inline-flex items-center gap-1 text-sm font-medium text-cream/70 transition-colors hover:text-gold-400"
          >
            <ChevronLeft className="h-4 w-4" /> All categories
          </Link>
          <RevealOnScroll y={12}>
            <h1 className="mt-2 font-display text-3xl font-bold sm:text-5xl">
              {category.name}
            </h1>
          </RevealOnScroll>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <CategoryNav categories={allCategories} active={category.slug} />

        <div className="mt-8">
          {dishes.length === 0 ? (
            <p className="py-16 text-center text-ink/50">
              No dishes in this category yet.
            </p>
          ) : (
            <CategoryDishBrowser dishes={dishes} />
          )}
        </div>
      </div>
    </div>
  );
}
