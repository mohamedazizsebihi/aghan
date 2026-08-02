import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DishForm } from "@/components/admin/DishForm";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { ARModelUploader } from "@/components/admin/ARModelUploader";
import { meshyEnabled } from "@/lib/meshy";

export const dynamic = "force-dynamic";

export default async function EditDishPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [dish, categories] = await Promise.all([
    prisma.dish.findUnique({ where: { id }, include: { category: true } }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!dish) notFound();

  return (
    <div>
      <Link
        href="/admin/dishes"
        className="inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Dishes
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold text-ink">
        Edit {dish.name}
      </h1>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink/5">
            <h2 className="mb-4 font-display text-lg font-semibold text-ink">
              Photo
            </h2>
            <ImageUploader dishId={dish.id} imageUrl={dish.imageUrl} />
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink/5">
            <h2 className="mb-4 font-display text-lg font-semibold text-ink">
              AR Model
            </h2>
            <ARModelUploader
              dishId={dish.id}
              dishName={dish.name}
              categorySlug={dish.category.slug}
              glbUrl={dish.arModelGlbUrl}
              posterUrl={dish.imageUrl}
              meshyEnabled={meshyEnabled}
              initialGenerationStatus={dish.arGenerationStatus}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink/5">
          <DishForm categories={categories} dish={dish} />
        </div>
      </div>
    </div>
  );
}
