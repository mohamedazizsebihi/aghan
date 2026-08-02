"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FulfillmentToggle,
  type FulfillmentChoice,
} from "@/components/checkout/FulfillmentToggle";
import { PaymentMethodChoice } from "@/components/checkout/PaymentMethodChoice";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import { DELIVERY_FEE_CENTS } from "@/lib/constants";
import { useCartStore } from "@/store/cart-store";
import {
  activeTableNumber,
  useTableSessionStore,
} from "@/store/table-session-store";
import { useHydrated } from "@/hooks/use-hydrated";

export function CheckoutForm({ stripeEnabled }: { stripeEnabled: boolean }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  /**
   * Null until the customer picks for themselves, so the QR scan can decide the
   * default. Storing the *choice* rather than the resulting value keeps this a
   * plain derivation — the table session isn't readable until after hydration,
   * and seeding useState from it would need an effect and a second render pass.
   */
  const [chosenFulfillment, setChosenFulfillment] =
    useState<FulfillmentChoice | null>(null);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [chosenPayment, setChosenPayment] = useState<"CASH" | "CARD">("CASH");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hydrated && items.length === 0) {
      router.replace("/menu");
    }
  }, [hydrated, items.length, router]);

  // Reading Date.now() via activeTableNumber is safe only once hydrated; before
  // that the component renders nothing (see the guard below).
  const tableSession = useTableSessionStore((s) => s.session);
  const tableNumber = hydrated ? activeTableNumber(tableSession) : null;

  const fulfillmentType: FulfillmentChoice =
    chosenFulfillment ?? (tableNumber !== null ? "DINE_IN" : "DELIVERY");

  /**
   * Dine-in is cash-only until online payment at a table is built, and the
   * server rejects the other combination outright. Deriving the method rather
   * than storing it means switching to dine-in with "Card" already selected
   * can't leave a stale choice behind that submits and fails.
   */
  const isDineIn = fulfillmentType === "DINE_IN";
  const paymentMethod: "CASH" | "CARD" = isDineIn ? "CASH" : chosenPayment;

  /**
   * The one case where contact details are pointless: staff bring the food to a
   * table they can see. Asking for a name and phone number would be friction
   * with nothing on the other end of it.
   *
   * The payment check is redundant *today* — `paymentMethod` is forced to CASH
   * whenever `isDineIn` — and is kept deliberately. It states the server's rule
   * verbatim (contact optional only for DINE_IN + CASH), and it becomes
   * load-bearing the moment dine-in card payment ships and that force is lifted.
   */
  const contactRequired = !(isDineIn && paymentMethod === "CASH");

  const deliveryFee = fulfillmentType === "DELIVERY" ? DELIVERY_FEE_CENTS : 0;
  const total = subtotal + deliveryFee;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fulfillmentType === "DELIVERY" && !address.trim()) {
      toast.error("Please enter a delivery address.");
      return;
    }
    // Reachable when a session lapses while the form is open: the toggle only
    // offers dine-in while a table is known, but the selection outlives it.
    if (fulfillmentType === "DINE_IN" && tableNumber === null) {
      toast.error(
        "Your table session has expired. Please scan the QR code on your table again."
      );
      return;
    }

    setSubmitting(true);
    const payload = {
      // Omitted entirely when not required, so the server sees "absent" rather
      // than an empty string it would have to interpret.
      customerName: contactRequired ? name : undefined,
      customerEmail: contactRequired ? email : undefined,
      customerPhone: contactRequired ? phone : undefined,
      fulfillmentType,
      deliveryAddress: fulfillmentType === "DELIVERY" ? address : undefined,
      // Sent only for dine-in — the schema rejects a table number on any other
      // type, so a stale scan can't leak onto a delivery order.
      tableNumber: fulfillmentType === "DINE_IN" ? tableNumber : undefined,
      notes: notes || undefined,
      items: items.map((i) => ({ dishId: i.dishId, quantity: i.quantity })),
    };

    try {
      if (paymentMethod === "CARD") {
        const res = await fetch("/api/checkout/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not start payment");
        window.location.href = data.url;
        return;
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not place order");

      router.push(`/checkout/success?orderId=${data.orderId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  if (!hydrated || items.length === 0) return null;

  return (
    <form onSubmit={handleSubmit} className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-8">
        {contactRequired && (
          <section>
            <h2 className="font-display text-xl font-semibold text-ink">
              Your Information
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <input
                required
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl border border-ink/15 px-4 py-3 text-sm outline-none focus:border-green-800"
              />
              <input
                required
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-xl border border-ink/15 px-4 py-3 text-sm outline-none focus:border-green-800"
              />
              <input
                required
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-ink/15 px-4 py-3 text-sm outline-none focus:border-green-800 sm:col-span-2"
              />
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">
            How would you like your order?
          </h2>
          <div className="mt-4">
            <FulfillmentToggle
              value={fulfillmentType}
              onChange={setChosenFulfillment}
              tableNumber={tableNumber}
            />
          </div>
          {fulfillmentType === "DINE_IN" && tableNumber !== null && (
            <p className="mt-3 rounded-xl bg-green-900/10 px-4 py-3 text-sm text-green-800">
              We&rsquo;ll bring your order to{" "}
              <span className="font-semibold">Table {tableNumber}</span>.
            </p>
          )}
          {fulfillmentType === "DELIVERY" && (
            <input
              required
              placeholder="Delivery address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-4 w-full rounded-xl border border-ink/15 px-4 py-3 text-sm outline-none focus:border-green-800"
            />
          )}
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">
            Special Instructions
          </h2>
          <textarea
            placeholder="Allergies, spice preferences, delivery notes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-4 w-full resize-none rounded-xl border border-ink/15 px-4 py-3 text-sm outline-none focus:border-green-800"
          />
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">Payment</h2>
          <div className="mt-4">
            <PaymentMethodChoice
              value={paymentMethod}
              onChange={setChosenPayment}
              cardEnabled={stripeEnabled && !isDineIn}
              cardDisabledReason={
                isDineIn
                  ? "Dine-in orders are cash only for now"
                  : "Online card payment is temporarily unavailable"
              }
            />
          </div>
          {isDineIn ? (
            <p className="mt-2 text-xs text-ink/40">
              Pay your server at the table. Card payment for dine-in is coming
              soon.
            </p>
          ) : (
            !stripeEnabled && (
              <p className="mt-2 text-xs text-ink/40">
                Online card payments will be available soon — pay by cash for now.
              </p>
            )
          )}
        </section>
      </div>

      <div className="h-fit rounded-2xl bg-green-950 p-6 text-cream">
        <h2 className="font-display text-xl font-semibold">Order Summary</h2>
        <div className="mt-4 space-y-3 text-sm">
          {items.map((item) => (
            <div key={item.dishId} className="flex justify-between text-cream/80">
              <span>
                {item.quantity} × {item.name}
              </span>
              <span>{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-2 border-t border-cream/15 pt-4 text-sm">
          <div className="flex justify-between text-cream/70">
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-cream/70">
            <span>Delivery Fee</span>
            <span>{deliveryFee > 0 ? formatPrice(deliveryFee) : "Free"}</span>
          </div>
          <div className="flex justify-between pt-2 font-display text-lg font-semibold text-cream">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>
        <Button type="submit" disabled={submitting} className="mt-6 w-full">
          {submitting ? "Placing Order…" : `Place Order — ${formatPrice(total)}`}
        </Button>
      </div>
    </form>
  );
}
