import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { PatternPlaceholder } from "@/components/ui/PatternPlaceholder";
import { SpiceLevelBadge } from "@/components/menu/SpiceLevelBadge";
import { DishCard } from "@/components/menu/DishCard";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { AddToCartButton } from "@/components/dish/AddToCartButton";
import { ARSection } from "@/components/dish/ARSection";
import { getCategoryIcon } from "@/lib/category-icons";
import { csvToList } from "@/lib/utils";
import { SPICE_LEVEL_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function getDish(slug: string) {
  return prisma.dish.findUnique({
    where: { slug },
    include: { category: true },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dish = await getDish(slug);
  if (!dish) return { title: "Dish Not Found | Bagh-e-Kabul" };
  return {
    title: `${dish.name} | Bagh-e-Kabul`,
    description: dish.description,
  };
}

export default async function DishDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dish = await getDish(slug);
  if (!dish || !dish.isAvailable) notFound();

  const relatedDishes = await prisma.dish.findMany({
    where: {
      categoryId: dish.categoryId,
      isAvailable: true,
      NOT: { id: dish.id },
    },
    include: { category: true },
    take: 3,
  });

  const ingredients = csvToList(dish.ingredients);
  const allergens = csvToList(dish.allergens).filter(
    (a) => a.toLowerCase() !== "none"
  );

  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8">
        <Link
          href="/menu"
          className="inline-flex items-center gap-1 text-sm font-medium text-ink/60 transition-colors hover:text-burgundy-700"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Menu
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <RevealOnScroll y={16}>
            <div className="relative aspect-square w-full overflow-hidden rounded-3xl shadow-xl shadow-ink/10">
              {dish.imageUrl ? (
                <Image
                  src={dish.imageUrl}
                  alt={dish.name}
                  fill
                  priority
                  sizes="(min-width: 1024px) 560px, 100vw"
                  className="object-cover"
                />
              ) : (
                <PatternPlaceholder icon={getCategoryIcon(dish.category.slug)} />
              )}
            </div>
          </RevealOnScroll>

          <RevealOnScroll y={16} delay={0.1}>
            <div className="flex h-full flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="green">{dish.category.name}</Badge>
                {dish.isPopular && <Badge tone="gold">Popular</Badge>}
                {dish.spiceLevel !== "NONE" && (
                  <Badge tone="burgundy" className="gap-1.5">
                    <SpiceLevelBadge level={dish.spiceLevel} />
                    {SPICE_LEVEL_LABEL[dish.spiceLevel]}
                  </Badge>
                )}
              </div>

              <h1 className="mt-4 font-display text-4xl font-bold text-ink sm:text-5xl">
                {dish.name}
              </h1>

              <p className="mt-4 text-lg leading-relaxed text-ink/70">
                {dish.description}
              </p>

              <div className="mt-8">
                <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink/50">
                  Ingredients
                </p>
                <div className="flex flex-wrap gap-2">
                  {ingredients.map((ing) => (
                    <span
                      key={ing}
                      className="rounded-full bg-ink/5 px-3 py-1 text-sm text-ink/70"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              </div>

              {allergens.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink/50">
                    Allergens
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allergens.map((a) => (
                      <span
                        key={a}
                        className="rounded-full border border-burgundy-700/30 bg-burgundy-700/5 px-3 py-1 text-sm text-burgundy-700"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-10 flex flex-wrap items-start gap-4">
                <AddToCartButton dish={dish} />
              </div>

              {/* Kept out of the flex row above: once opened this expands into
                  a full 3D viewer, and as a flex item it had no determinate
                  width to render into. */}
              {dish.arModelGlbUrl && (
                <div className="mt-4">
                  <ARSection
                    glbUrl={dish.arModelGlbUrl}
                    posterUrl={dish.imageUrl}
                    alt={dish.name}
                  />
                </div>
              )}
            </div>
          </RevealOnScroll>
        </div>

        {relatedDishes.length > 0 && (
          <div className="mt-20">
            <RevealOnScroll>
              <h2 className="font-display text-2xl font-bold text-ink">
                You Might Also Like
              </h2>
            </RevealOnScroll>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {relatedDishes.map((related) => (
                <DishCard key={related.id} dish={related} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
