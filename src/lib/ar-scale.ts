/**
 * Real-world size of a served dish, per menu category, expressed as the
 * longest side of its bounding box in metres.
 *
 * Why this file exists: glTF is specified in metres, and Scene Viewer /
 * Quick Look place a model at exactly the size the file claims. That number
 * *is* the portion size the customer sees on their table — it is the whole
 * point of the feature, not a rendering detail.
 *
 * We used to delegate this to Meshy's `auto_size`, which estimates real-world
 * height by AI vision from a single cropped photo. Measured against the
 * generated files, it was off by roughly 2x and — worse — inconsistent:
 * two generations of the same aubergine dish came out at 14.7cm and 22.2cm,
 * and a lamb skewer at 13.8cm. A fixed number per category is less clever,
 * but it is coherent across the menu, and coherence is what makes portion
 * sizes believable.
 *
 * The longest side is used (rather than height) because a plated dish shot
 * from above is widest across its serving vessel — so in practice these
 * numbers are plate and bowl diameters.
 */

/** Standard dinner plate — used for any category not listed below. */
export const DEFAULT_DISH_SIZE_M = 0.26;

const DISH_SIZE_BY_CATEGORY_M: Record<string, number> = {
  "chef-s-specials": 0.3, // signature plates, served on a large platter
  "mazza-appetizers": 0.2, // mezze served in small dishes
  dumplings: 0.26, // mantu / ashak on a dinner plate
  "grilled-meats-to-start": 0.28, // starter skewers on an oblong plate
  "soups-salads": 0.2, // soup bowl / individual salad bowl
  "chops-kabobs": 0.34, // full-length kabob skewers over rice
  "qormas-entrees": 0.28, // main-course plate
  "vegetarian-vegan": 0.26,
  sides: 0.2, // side bowl
};

export function dishSizeForCategory(categorySlug: string): number {
  return DISH_SIZE_BY_CATEGORY_M[categorySlug] ?? DEFAULT_DISH_SIZE_M;
}
