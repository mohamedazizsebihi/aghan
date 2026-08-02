import { z } from "zod";
import { MAX_TABLE_COUNT } from "@/lib/table-qr";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Upper bounds on everything a stranger can send.
 *
 * Without them the checkout schema accepted an unbounded `items` array and
 * unbounded strings: one unauthenticated request with 50,000 line items was
 * accepted and committed 50,000 OrderItem rows, holding the SQLite write lock
 * for 22 seconds and blocking every other request in the process.
 *
 * These are sized for a restaurant order, not for what the format allows — a
 * real cart is a handful of dishes.
 */
export const MAX_ITEMS_PER_ORDER = 50;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254; // RFC 5321 maximum path length
const MAX_PHONE_LENGTH = 30;
const MAX_ADDRESS_LENGTH = 300;
const MAX_NOTES_LENGTH = 1000;
/** A cuid is 25 characters; the slack is for id formats we might migrate to. */
const MAX_ID_LENGTH = 64;

const cartItemSchema = z.object({
  dishId: z.string().min(1).max(MAX_ID_LENGTH),
  quantity: z.number().int().min(1).max(20),
});

/**
 * Format rules for the contact fields, defined once.
 *
 * Whether each one is *required* varies by order type, but what counts as a
 * valid name or email never does — so the shape lives here and only optionality
 * is re-decided per variant below. Duplicating these into each variant is how
 * the two drift apart.
 */
const CONTACT_REQUIRED_MESSAGE = {
  customerName: "Please enter your full name",
  customerEmail: "Please enter a valid email",
  customerPhone: "Please enter a valid phone number",
} as const;

// The `error` option covers the field being absent entirely, which is how the
// card variant reports a missing name instead of Zod's raw "expected string,
// received undefined". In the base variant these are wrapped in optionalText(),
// where absence is legal and the message never fires.
const customerNameField = z
  .string({ error: CONTACT_REQUIRED_MESSAGE.customerName })
  .min(2, CONTACT_REQUIRED_MESSAGE.customerName)
  .max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or fewer`);
const customerEmailField = z
  .string({ error: CONTACT_REQUIRED_MESSAGE.customerEmail })
  .max(MAX_EMAIL_LENGTH, "That email address is too long")
  .regex(emailRegex, CONTACT_REQUIRED_MESSAGE.customerEmail);
const customerPhoneField = z
  .string({ error: CONTACT_REQUIRED_MESSAGE.customerPhone })
  .min(6, CONTACT_REQUIRED_MESSAGE.customerPhone)
  .max(MAX_PHONE_LENGTH, "That phone number is too long");

/**
 * Optional text where an empty string counts as absent.
 *
 * A form field that was rendered and left blank submits `""`, not `undefined`.
 * Without this, clearing the name box on a dine-in order would fail `min(2)`
 * instead of being read as "not provided".
 */
function optionalText<T extends z.ZodType<string>>(field: T) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    field.optional()
  );
}

/**
 * Everything an order needs, with contact details optional.
 *
 * Optionality is decided by the two variants below, because it depends on the
 * payment method — which is a property of the *route*, not of the payload.
 * Keeping the base permissive and tightening per variant means a new order type
 * has one obvious place to declare its own rules.
 */
const baseOrderSchema = z
  .object({
    customerName: optionalText(customerNameField),
    customerEmail: optionalText(customerEmailField),
    customerPhone: optionalText(customerPhoneField),
    fulfillmentType: z.enum(["DELIVERY", "PICKUP", "DINE_IN"]),
    deliveryAddress: z
      .string()
      .max(MAX_ADDRESS_LENGTH, `Address must be ${MAX_ADDRESS_LENGTH} characters or fewer`)
      .optional(),
    /** Only meaningful for DINE_IN; see the refinement below. */
    tableNumber: z
      .number()
      .int("Table number must be a whole number")
      .min(1, "Table number must be at least 1")
      .max(MAX_TABLE_COUNT, `Table number must be at most ${MAX_TABLE_COUNT}`)
      .optional(),
    notes: z
      .string()
      .max(MAX_NOTES_LENGTH, `Notes must be ${MAX_NOTES_LENGTH} characters or fewer`)
      .optional(),
    items: z
      .array(cartItemSchema)
      .min(1, "Your cart is empty")
      .max(
        MAX_ITEMS_PER_ORDER,
        `An order can contain at most ${MAX_ITEMS_PER_ORDER} different items. Please split it into separate orders.`
      ),
  });

type BaseOrderInput = z.infer<typeof baseOrderSchema>;

/**
 * `tableNumber` and `fulfillmentType` have to agree, whatever the payment
 * method, so both variants run this.
 *
 * The second rule matters as much as the first: without it a delivery order
 * could carry a stale table number from an earlier scan, and the kitchen would
 * see "Table 5" on an order going out on a bike.
 */
function checkFulfillment(data: BaseOrderInput, ctx: z.RefinementCtx) {
  if (data.fulfillmentType === "DINE_IN") {
    if (data.tableNumber === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["tableNumber"],
        message:
          "Scan the QR code on your table to order for dine-in, or choose pickup or delivery.",
      });
    }
    return;
  }

  if (data.tableNumber !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["tableNumber"],
      message: "Only dine-in orders can have a table number.",
    });
  }
}

function requireContactDetails(data: BaseOrderInput, ctx: z.RefinementCtx) {
  for (const field of ["customerName", "customerEmail", "customerPhone"] as const) {
    if (data[field] === undefined) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: CONTACT_REQUIRED_MESSAGE[field],
      });
    }
  }
}

/**
 * Cash orders — `POST /api/orders`.
 *
 * A cash dine-in customer is sitting at a table the restaurant can see, so a
 * name, email, and phone number are friction with nothing on the other end of
 * them: staff walk the food over. The table number is the identity.
 *
 * Delivery and pickup are unchanged — the food leaves the building, so there
 * has to be a way to reach whoever is collecting it.
 */
export const cashOrderSchema = baseOrderSchema.superRefine((data, ctx) => {
  checkFulfillment(data, ctx);
  if (data.fulfillmentType !== "DINE_IN") {
    requireContactDetails(data, ctx);
  }
});

/**
 * Card orders — `POST /api/checkout/session`.
 *
 * Contact details are required at the object level rather than by refinement,
 * which is what lets the inferred type carry non-null strings through to
 * Stripe's `customer_email` without a redundant runtime check.
 *
 * Dine-in is refused here: paying online for food brought to your table is a
 * flow that hasn't been built (no way to tie a Stripe session to a table
 * mid-service), and silently accepting it would create orders the floor staff
 * can't reconcile. Cash is the dine-in path for now.
 */
export const cardOrderSchema = baseOrderSchema
  .extend({
    customerName: customerNameField,
    customerEmail: customerEmailField,
    customerPhone: customerPhoneField,
  })
  .superRefine((data, ctx) => {
    checkFulfillment(data, ctx);
    if (data.fulfillmentType === "DINE_IN") {
      ctx.addIssue({
        code: "custom",
        path: ["fulfillmentType"],
        message:
          "Dine-in orders are cash only for now. Please pay with cash, or choose pickup or delivery to pay by card.",
      });
    }
  });

/**
 * What order-building code accepts: contact details possibly absent. Card
 * orders parse to a stricter shape that satisfies this, so one builder serves
 * both.
 */
export type OrderInput = BaseOrderInput;

export const dishInputSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().min(1),
  ingredients: z.string().min(1),
  allergens: z.string().optional().default(""),
  price: z.number().int().min(0),
  spiceLevel: z.enum(["NONE", "MILD", "MEDIUM", "HOT"]),
  categoryId: z.string().min(1),
  isPopular: z.boolean().optional().default(false),
  isAvailable: z.boolean().optional().default(true),
  imageUrl: z.string().optional().nullable(),
});

export const categoryInputSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  sortOrder: z.number().int().optional().default(0),
});

/**
 * Login is unauthenticated too, so its inputs are bounded on the same grounds.
 * bcrypt only reads the first 72 bytes of a password, making everything beyond
 * that pure cost with no effect on the comparison.
 */
/**
 * `count` is how many tables to **add**, not how many the restaurant has.
 *
 * The earlier "how many do you have" reading was a trap: entering a smaller
 * figure than the current table count did nothing at all, so the field promised
 * something it could not do. Adding is the only creation verb now, which is
 * also what keeps numbers append-only — see the POST handler.
 */
export const addTablesSchema = z.object({
  count: z
    .number()
    .int("Enter a whole number of tables")
    .min(1, "Add at least 1 table")
    .max(MAX_TABLE_COUNT, `At most ${MAX_TABLE_COUNT} tables at a time`),
});

export const tableUpdateSchema = z.object({
  isActive: z.boolean(),
});

export const adminLoginSchema = z.object({
  email: z
    .string()
    .max(MAX_EMAIL_LENGTH, "That email address is too long")
    .regex(emailRegex, "Please enter a valid email"),
  password: z.string().min(1, "Password is required").max(200),
});

export const orderStatusSchema = z.object({
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
    "COMPLETED",
    "CANCELLED",
  ]),
});

export const orderUpdateSchema = z
  .object({
    status: orderStatusSchema.shape.status.optional(),
    paymentStatus: z.enum(["UNPAID", "PAID", "FAILED", "REFUNDED"]).optional(),
  })
  .refine((data) => data.status !== undefined || data.paymentStatus !== undefined, {
    message: "Nothing to update",
  });
