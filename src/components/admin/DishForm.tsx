"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { slugify } from "@/lib/utils";
import type { Category, Dish, SpiceLevel } from "@/generated/prisma/client";

const SPICE_LEVELS: SpiceLevel[] = ["NONE", "MILD", "MEDIUM", "HOT"];

export function DishForm({
  categories,
  dish,
}: {
  categories: Category[];
  dish?: Dish;
}) {
  const router = useRouter();
  const isEdit = Boolean(dish);

  const [name, setName] = useState(dish?.name ?? "");
  const [slug, setSlug] = useState(dish?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [description, setDescription] = useState(dish?.description ?? "");
  const [ingredients, setIngredients] = useState(dish?.ingredients ?? "");
  const [allergens, setAllergens] = useState(dish?.allergens ?? "");
  const [price, setPrice] = useState(dish ? (dish.price / 100).toFixed(2) : "");
  const [categoryId, setCategoryId] = useState(
    dish?.categoryId ?? categories[0]?.id ?? ""
  );
  const [spiceLevel, setSpiceLevel] = useState<SpiceLevel>(dish?.spiceLevel ?? "NONE");
  const [isPopular, setIsPopular] = useState(dish?.isPopular ?? false);
  const [isAvailable, setIsAvailable] = useState(dish?.isAvailable ?? true);
  const [submitting, setSubmitting] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      name,
      slug: slugify(slug || name),
      description,
      ingredients,
      allergens: allergens || "None",
      price: Math.round(parseFloat(price || "0") * 100),
      categoryId,
      spiceLevel,
      isPopular,
      isAvailable,
    };

    try {
      const res = await fetch(isEdit ? `/api/dishes/${dish!.id}` : "/api/dishes", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save dish");

      toast.success(isEdit ? "Dish updated" : "Dish created");
      if (isEdit) {
        router.refresh();
      } else {
        router.push(`/admin/dishes/${data.dish.id}/edit`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Slug">
          <input
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className="input"
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          required
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input resize-none"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ingredients (comma-separated)">
          <input
            required
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Allergens (comma-separated, or None)">
          <input
            value={allergens}
            onChange={(e) => setAllergens(e.target.value)}
            className="input"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Price (USD)">
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Category">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="input"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Spice Level">
          <select
            value={spiceLevel}
            onChange={(e) => setSpiceLevel(e.target.value as SpiceLevel)}
            className="input"
          >
            {SPICE_LEVELS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={isPopular}
            onChange={(e) => setIsPopular(e.target.checked)}
            className="h-4 w-4 rounded border-ink/30"
          />
          Popular
        </label>
        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setIsAvailable(e.target.checked)}
            className="h-4 w-4 rounded border-ink/30"
          />
          Available on menu
        </label>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Dish"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink/45">
        {label}
      </span>
      {children}
    </label>
  );
}
