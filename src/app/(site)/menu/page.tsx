import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CategoryCard } from "@/components/menu/CategoryCard";
import { MenuSearch } from "@/components/menu/MenuSearch";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { TableSessionCapture } from "@/components/menu/TableSessionCapture";
import { parseTableParam } from "@/lib/table-qr";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Menu | Bagh-e-Kabul",
  description:
    "Explore our full menu of authentic Afghan starters, grilled dishes, qormas, vegetarian plates, and more — browse by category.",
};

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string | string[] }>;
}) {
  // Set by the QR code on each table (admin → Tables). Parsed for shape here,
  // then confirmed against the Table model below — a number nobody printed a
  // code for must not start a dine-in session it can't finish, since checkout
  // would reject it anyway.
  const requestedTable = parseTableParam((await searchParams).table);

  const [categories, dishes, table] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { dishes: { where: { isAvailable: true } } } } },
    }),
    prisma.dish.findMany({
      where: { isAvailable: true },
      include: { category: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    }),
    requestedTable === null
      ? null
      : prisma.table.findUnique({ where: { number: requestedTable } }),
  ]);

  const tableNumber = table?.isActive ? table.number : null;

  const searchableDishes = dishes.map((dish) => ({
    slug: dish.slug,
    name: dish.name,
    description: dish.description,
    price: dish.price,
    imageUrl: dish.imageUrl,
    categoryName: dish.category.name,
  }));

  return (
    <div className="bg-cream">
      {tableNumber !== null && <TableSessionCapture tableNumber={tableNumber} />}
      <div className="relative overflow-hidden bg-green-950 py-16 text-center text-cream sm:py-20">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/video_pain_afghan_15s.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-green-950/75 via-green-950/55 to-green-950/85" />
        <div className="relative mx-auto max-w-3xl px-6">
          <RevealOnScroll>
            <p className="text-xs uppercase tracking-[0.4em] text-gold-400">
              Our Menu
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">
              A Taste of Afghanistan
            </h1>
            <p className="mt-4 text-cream/70">
              Every dish is prepared from traditional family recipes, made
              fresh with authentic spices and warm hospitality.
            </p>
          </RevealOnScroll>
          <RevealOnScroll delay={0.1} className="mt-8">
            <MenuSearch dishes={searchableDishes} />
          </RevealOnScroll>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-center text-sm text-ink/50">
          Choose a category to start building your order.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category, i) => (
            <RevealOnScroll key={category.id} delay={i * 0.05}>
              <CategoryCard
                slug={category.slug}
                name={category.name}
                imageUrl={category.imageUrl}
                dishCount={category._count.dishes}
              />
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </div>
  );
}
