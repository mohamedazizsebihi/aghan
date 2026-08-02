export const SITE_NAME = "Bagh-e-Kabul";
export const SITE_TAGLINE = "Le Jardin de Kaboul";

/**
 * Placeholder business info — swap these for the real details in one place.
 */
export const RESTAURANT = {
  addressLine1: "123 Kabul Street",
  addressLine2: "San Francisco, CA 94103",
  phone: "+1 (555) 010-0100",
  email: "hello@bagh-e-kabul.com",
  hours: [
    { day: "Monday", hours: "Closed" },
    { day: "Tuesday – Friday", hours: "11:00 AM – 10:00 PM" },
    { day: "Saturday – Sunday", hours: "12:00 PM – 11:00 PM" },
  ],
  mapEmbedSrc:
    "https://www.google.com/maps?q=San+Francisco,CA&output=embed",
  social: {
    instagram: "https://instagram.com",
    facebook: "https://facebook.com",
  },
} as const;

export const DELIVERY_FEE_CENTS = 500;
export const CURRENCY = "usd";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/orders", label: "My Orders" },
  { href: "/about", label: "Our Story" },
  { href: "/contact", label: "Contact" },
] as const;

const FULFILLMENT_LABEL: Record<string, string> = {
  DELIVERY: "Delivery",
  PICKUP: "Pickup",
  DINE_IN: "Dine-in",
};

/**
 * How a fulfillment type reads to a human. For dine-in the table number is part
 * of the answer, not a detail beside it — "Dine-in" alone tells the kitchen
 * nothing actionable.
 */
export function fulfillmentLabel(type: string, tableNumber?: number | null) {
  const label = FULFILLMENT_LABEL[type] ?? type;
  return type === "DINE_IN" && tableNumber != null
    ? `${label} · Table ${tableNumber}`
    : label;
}

/**
 * Who an order belongs to, for lists and headings.
 *
 * A cash dine-in order has no name by design, so the table is the identity —
 * and it's the more useful label anyway: staff are looking for where to carry
 * the food, not who typed what.
 */
export function orderCustomerLabel(order: {
  customerName: string | null;
  fulfillmentType: string;
  tableNumber: number | null;
}) {
  if (order.customerName) return order.customerName;
  if (order.fulfillmentType === "DINE_IN" && order.tableNumber != null) {
    return `Table ${order.tableNumber}`;
  }
  return "Guest";
}

export const SPICE_LEVEL_LABEL: Record<string, string> = {
  NONE: "Not Spicy",
  MILD: "Mild",
  MEDIUM: "Medium",
  HOT: "Hot",
};

export const SPICE_LEVEL_ICON_COUNT: Record<string, number> = {
  NONE: 0,
  MILD: 1,
  MEDIUM: 2,
  HOT: 3,
};
