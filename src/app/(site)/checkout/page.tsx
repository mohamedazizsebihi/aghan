import type { Metadata } from "next";
import { stripeEnabled } from "@/lib/stripe";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

// Without this, Next can statically prerender this page at build time and
// bake in whatever STRIPE_SECRET_KEY happened to be set in the build
// environment — which in Docker is none, permanently hiding the Card option
// even when the container is later run with Stripe configured.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout | Bagh-e-Kabul",
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8">
      <h1 className="font-display text-4xl font-bold text-ink">Checkout</h1>
      <div className="mt-10">
        <CheckoutForm stripeEnabled={stripeEnabled} />
      </div>
    </div>
  );
}
