import { UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tasteful stand-in for dishes without a real photo yet — an Afghan
 * geometric motif instead of a stock photo. Swappable per-dish anytime
 * via the admin image uploader.
 */
export function PatternPlaceholder({
  icon: Icon = UtensilsCrossed,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const patternId = "islimi-pattern";
  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-green-900 via-green-800 to-burgundy-900",
        className
      )}
    >
      <svg className="absolute inset-0 h-full w-full opacity-25" aria-hidden>
        <defs>
          <pattern
            id={patternId}
            width="56"
            height="56"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(15)"
          >
            <rect width="56" height="56" fill="none" />
            <path
              d="M28 4 L48 28 L28 52 L8 28 Z"
              fill="none"
              stroke="var(--color-gold-400)"
              strokeWidth="1"
            />
            <circle cx="28" cy="28" r="4" fill="var(--color-gold-400)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      <div className="relative flex flex-col items-center gap-2 text-gold-400">
        <Icon className="h-9 w-9" />
      </div>
    </div>
  );
}
