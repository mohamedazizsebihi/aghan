import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { DELIVERY_FEE_CENTS } from "@/lib/constants";
import { generateOrderNumber } from "@/lib/utils";
import type { OrderInput } from "@/lib/validators";

type CheckoutInput = OrderInput;

export class OrderBuildError extends Error {}

/**
 * Re-prices the cart server-side from the live Dish table — client-supplied
 * prices are never trusted — and returns everything needed to create the
 * Order + OrderItem rows.
 */
export async function buildOrderFromCart(input: CheckoutInput) {
  if (input.fulfillmentType === "DELIVERY" && !input.deliveryAddress?.trim()) {
    throw new OrderBuildError("A delivery address is required.");
  }
  // The schema already enforces this pairing; repeated here because everything
  // below writes an Order row, and a DINE_IN row without a table is one the
  // kitchen cannot act on.
  if (input.fulfillmentType === "DINE_IN" && input.tableNumber === undefined) {
    throw new OrderBuildError(
      "A table number is required for dine-in orders. Please scan the QR code on your table."
    );
  }

  /**
   * Which tables exist is a database fact, so it cannot be checked in the Zod
   * schema — that schema is pure and synchronous. This is the same layer, and
   * the same reasoning, as the dish availability check below: the client says
   * what it wants, the live tables say what is real.
   *
   * Without it, `?table=87` in a twelve-table restaurant produced a genuine
   * order for a table that does not exist — and since cash dine-in carries no
   * name or phone number, staff had food and no one to trace it to.
   */
  if (input.fulfillmentType === "DINE_IN" && input.tableNumber !== undefined) {
    const table = await prisma.table.findUnique({
      where: { number: input.tableNumber },
    });
    if (!table || !table.isActive) {
      throw new OrderBuildError(
        `Table ${input.tableNumber} isn't taking orders. Please scan the QR code on your table again, or ask a member of staff.`
      );
    }
  }

  const dishIds = input.items.map((i) => i.dishId);
  const foundDishes = await prisma.dish.findMany({ where: { id: { in: dishIds } } });
  const dishById = new Map(foundDishes.map((d) => [d.id, d]));

  const unavailable: string[] = [];
  for (const item of input.items) {
    const dish = dishById.get(item.dishId);
    if (!dish?.isAvailable) unavailable.push(dish?.name ?? "an item");
  }

  if (unavailable.length > 0) {
    const isPlural = unavailable.length > 1;
    throw new OrderBuildError(
      `${unavailable.join(", ")} ${isPlural ? "are" : "is"} no longer available. Please remove ${isPlural ? "them" : "it"} from your cart and try again.`
    );
  }

  const orderItems = input.items.map((item) => {
    const dish = dishById.get(item.dishId)!;
    return {
      dishId: dish.id,
      nameSnapshot: dish.name,
      priceSnapshot: dish.price,
      quantity: item.quantity,
    };
  });

  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.priceSnapshot * item.quantity,
    0
  );
  const deliveryFee = input.fulfillmentType === "DELIVERY" ? DELIVERY_FEE_CENTS : 0;
  const total = subtotal + deliveryFee;

  return {
    // `?? null` rather than `|| null`: absent and empty are already collapsed
    // to undefined by the schema, so this only maps undefined onto the column's
    // null without also discarding anything the customer did type.
    customerName: input.customerName ?? null,
    customerEmail: input.customerEmail ?? null,
    customerPhone: input.customerPhone ?? null,
    fulfillmentType: input.fulfillmentType,
    deliveryAddress: input.deliveryAddress || null,
    tableNumber: input.tableNumber ?? null,
    notes: input.notes || null,
    subtotal,
    deliveryFee,
    total,
    orderItems,
  };
}

const MAX_ORDER_NUMBER_ATTEMPTS = 5;

function isOrderNumberCollision(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    (error.meta?.target as string[] | undefined)?.includes("orderNumber")
  );
}

/**
 * generateOrderNumber() has a 1-in-9000 daily collision chance against the
 * unique orderNumber column — rare enough to slip past testing but frequent
 * enough to eventually fail a real customer's checkout. Retries with a
 * fresh number instead of surfacing the raw constraint error.
 */
export async function createOrder(data: Omit<Prisma.OrderCreateInput, "orderNumber">) {
  for (let attempt = 1; attempt <= MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
    try {
      return await prisma.order.create({
        data: { ...data, orderNumber: generateOrderNumber() },
      });
    } catch (error) {
      if (!isOrderNumberCollision(error) || attempt === MAX_ORDER_NUMBER_ATTEMPTS) {
        throw error;
      }
    }
  }
  throw new Error("unreachable");
}
