import type { Metadata } from "next";
import { MyOrdersList } from "@/components/orders/MyOrdersList";

export const metadata: Metadata = {
  title: "My Orders | Bagh-e-Kabul",
  description: "Follow the orders you have placed.",
};

export default function MyOrdersPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 sm:py-20">
      <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
        My Orders
      </h1>
      <p className="mt-2 text-sm text-ink/50">
        Orders placed on this phone. No account needed.
      </p>
      <div className="mt-8">
        <MyOrdersList />
      </div>
    </div>
  );
}
