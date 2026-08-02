import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { PatternPlaceholder } from "@/components/ui/PatternPlaceholder";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { LinkButton } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDishesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      dishes: { orderBy: { sortOrder: "asc" } },
    },
  });

  const totalDishes = categories.reduce((sum, c) => sum + c.dishes.length, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-ink">Dishes</h1>
        <LinkButton href="/admin/dishes/new" size="sm">
          <Plus className="h-4 w-4" /> Add Dish
        </LinkButton>
      </div>

      {totalDishes === 0 ? (
        <p className="mt-6 rounded-2xl bg-white px-6 py-10 text-center text-ink/40 shadow-sm ring-1 ring-ink/5">
          No dishes yet.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {categories.map((category) => (
              <a
                key={category.id}
                href={`#${category.slug}`}
                className="whitespace-nowrap rounded-full bg-white px-4 py-2 text-sm font-medium text-ink/70 shadow-sm ring-1 ring-ink/10 transition-colors hover:bg-ink/[0.03]"
              >
                {category.name}{" "}
                <span className="text-ink/40">({category.dishes.length})</span>
              </a>
            ))}
          </div>

          <div className="mt-8 space-y-10">
            {categories.map((category) => (
              <section key={category.id} id={category.slug} className="scroll-mt-6">
                <h2 className="font-display text-xl font-semibold text-ink">
                  {category.name}
                  <span className="ml-2 text-sm font-normal text-ink/40">
                    {category.dishes.length} dish(es)
                  </span>
                </h2>

                <div className="mt-3 rounded-2xl bg-white shadow-sm ring-1 ring-ink/5">
                  {category.dishes.length === 0 ? (
                    <p className="px-6 py-8 text-center text-ink/40">
                      No dishes in this category yet.
                    </p>
                  ) : (
                    <>
                      {/* Mobile / tablet-portrait: stacked cards instead of a cramped table */}
                      <div className="divide-y divide-ink/5 md:hidden">
                        {category.dishes.map((dish) => (
                          <div key={dish.id} className="flex items-center gap-3 px-5 py-4">
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                              {dish.imageUrl ? (
                                <Image
                                  src={dish.imageUrl}
                                  alt={dish.name}
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              ) : (
                                <PatternPlaceholder />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-ink">{dish.name}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-medium text-ink/70">
                                  {formatPrice(dish.price)}
                                </span>
                                <Badge tone={dish.isAvailable ? "green" : "neutral"}>
                                  {dish.isAvailable ? "Available" : "Hidden"}
                                </Badge>
                                {dish.isPopular && <Badge tone="gold">Popular</Badge>}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <Link
                                href={`/admin/dishes/${dish.id}/edit`}
                                className="text-sm font-medium text-burgundy-700 hover:underline"
                              >
                                Edit
                              </Link>
                              <DeleteButton
                                url={`/api/dishes/${dish.id}`}
                                confirmMessage={`Delete "${dish.name}"? This cannot be undone.`}
                                label=""
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Tablet-landscape / desktop: full table */}
                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[560px] text-left text-sm">
                          <thead className="border-b border-ink/5 bg-ink/[0.02] text-xs uppercase tracking-wider text-ink/45">
                            <tr>
                              <th className="px-6 py-3">Dish</th>
                              <th className="px-6 py-3">Price</th>
                              <th className="px-6 py-3">Status</th>
                              <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink/5">
                            {category.dishes.map((dish) => (
                              <tr key={dish.id} className="hover:bg-ink/[0.02]">
                                <td className="px-6 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                                      {dish.imageUrl ? (
                                        <Image
                                          src={dish.imageUrl}
                                          alt={dish.name}
                                          fill
                                          sizes="48px"
                                          className="object-cover"
                                        />
                                      ) : (
                                        <PatternPlaceholder />
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-medium text-ink">{dish.name}</p>
                                      {dish.isPopular && (
                                        <Badge tone="gold" className="mt-1">
                                          Popular
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-3 font-medium text-ink">
                                  {formatPrice(dish.price)}
                                </td>
                                <td className="px-6 py-3">
                                  <Badge tone={dish.isAvailable ? "green" : "neutral"}>
                                    {dish.isAvailable ? "Available" : "Hidden"}
                                  </Badge>
                                </td>
                                <td className="px-6 py-3">
                                  <div className="flex items-center justify-end gap-4">
                                    <Link
                                      href={`/admin/dishes/${dish.id}/edit`}
                                      className="text-sm font-medium text-burgundy-700 hover:underline"
                                    >
                                      Edit
                                    </Link>
                                    <DeleteButton
                                      url={`/api/dishes/${dish.id}`}
                                      confirmMessage={`Delete "${dish.name}"? This cannot be undone.`}
                                      label=""
                                    />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
