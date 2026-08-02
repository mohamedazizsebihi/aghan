import {
  Sparkles,
  Soup,
  CookingPot,
  Flame,
  Salad,
  Beef,
  UtensilsCrossed,
  Leaf,
  Wheat,
} from "lucide-react";

export const CATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "chef-s-specials": Sparkles,
  "mazza-appetizers": Soup,
  dumplings: CookingPot,
  "grilled-meats-to-start": Flame,
  "soups-salads": Salad,
  "chops-kabobs": Beef,
  "qormas-entrees": UtensilsCrossed,
  "vegetarian-vegan": Leaf,
  sides: Wheat,
};

export function getCategoryIcon(categorySlug: string) {
  return CATEGORY_ICONS[categorySlug] ?? UtensilsCrossed;
}
