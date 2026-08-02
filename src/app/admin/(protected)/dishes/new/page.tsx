import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DishForm } from "@/components/admin/DishForm";

export const dynamic = "force-dynamic";

export default async function NewDishPage() {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div>
      <Link
        href="/admin/dishes"
        className="inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Back to Dishes
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold text-ink">Add Dish</h1>

      <div className="mt-8 max-w-2xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-ink/5">
        <DishForm categories={categories} />
      </div>
    </div>
  );
}
