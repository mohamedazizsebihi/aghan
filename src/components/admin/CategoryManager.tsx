"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { CategoryImageUploader } from "@/components/admin/CategoryImageUploader";
import { slugify } from "@/lib/utils";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  sortOrder: number;
  _count: { dishes: number };
};

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slugify(name),
          sortOrder:
            categories.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add category");
      toast.success("Category added");
      setName("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add category");
    } finally {
      setSubmitting(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = categories[index + direction];
    const current = categories[index];
    if (!target) return;

    await Promise.all([
      fetch(`/api/categories/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: target.sortOrder }),
      }),
      fetch(`/api/categories/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: current.sortOrder }),
      }),
    ]);
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          className="input max-w-xs"
        />
        <Button type="submit" disabled={submitting} size="sm">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      <div className="mt-6 divide-y divide-ink/5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink/5">
        {categories.map((category, index) => (
          <div key={category.id} className="flex items-center gap-3 px-5 py-4 sm:gap-4 sm:px-6">
            <CategoryImageUploader
              categoryId={category.id}
              categorySlug={category.slug}
              imageUrl={category.imageUrl}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{category.name}</p>
              <p className="text-xs text-ink/45">
                {category._count.dishes} dish(es)
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="rounded-full p-3 text-ink/50 hover:bg-ink/5 disabled:opacity-30"
                aria-label="Move up"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                disabled={index === categories.length - 1}
                onClick={() => move(index, 1)}
                className="rounded-full p-3 text-ink/50 hover:bg-ink/5 disabled:opacity-30"
                aria-label="Move down"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <DeleteButton
                url={`/api/categories/${category.id}`}
                confirmMessage={`Delete category "${category.name}"?`}
                label=""
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
