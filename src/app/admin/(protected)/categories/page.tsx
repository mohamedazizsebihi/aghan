import { prisma } from "@/lib/prisma";
import { CategoryManager } from "@/components/admin/CategoryManager";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { dishes: true } } },
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">Categories</h1>
      <p className="mt-1 text-sm text-ink/50">
        Reorder categories to control how they appear on the public menu.
      </p>
      <div className="mt-6">
        <CategoryManager categories={categories} />
      </div>
    </div>
  );
}
