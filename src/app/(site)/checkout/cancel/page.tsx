import { XCircle } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { cancelUnpaidOrder } from "@/lib/order-payments";

export const dynamic = "force-dynamic";

export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;

  /**
   * Actually cancel the order, rather than just saying so.
   *
   * Starting a card checkout writes the Order row before the customer reaches
   * Stripe, so backing out left it PENDING for ever — this page told the
   * customer nothing had happened while the row sat in the database waiting for
   * a payment that was never coming. `cancelUnpaidOrder` only touches an order
   * still unpaid and still pending, so returning here after paying on a second
   * attempt cannot undo that payment.
   */
  if (orderId) await cancelUnpaidOrder(orderId);

  return (
    <div className="mx-auto max-w-lg px-5 py-24 text-center sm:px-8">
      <XCircle className="mx-auto h-14 w-14 text-burgundy-700" />
      <h1 className="mt-6 font-display text-4xl font-bold text-ink">
        Payment Cancelled
      </h1>
      <p className="mt-3 text-ink/60">
        Your payment was cancelled and you have not been charged. Your cart
        is still saved if you&rsquo;d like to try again.
      </p>
      <LinkButton href="/checkout" size="lg" className="mt-8">
        Back to Checkout
      </LinkButton>
    </div>
  );
}
