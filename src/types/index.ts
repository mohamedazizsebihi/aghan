import type { Category, Dish } from "@/generated/prisma/client";

export type DishWithCategory = Dish & { category: Category };
