import { LinkButton } from "@/components/ui/Button";

export function NotFoundContent({
  className = "min-h-[70vh]",
}: {
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center bg-cream px-6 text-center ${className}`}
    >
      <p className="font-display text-7xl font-bold text-gold-500">404</p>
      <h1 className="mt-4 font-display text-3xl font-bold text-ink">
        This Table Isn&rsquo;t Set
      </h1>
      <p className="mt-3 max-w-sm text-ink/60">
        The page you&rsquo;re looking for doesn&rsquo;t exist. Let&rsquo;s get
        you back to something delicious.
      </p>
      <LinkButton href="/menu" size="lg" className="mt-8">
        Browse the Menu
      </LinkButton>
    </div>
  );
}
