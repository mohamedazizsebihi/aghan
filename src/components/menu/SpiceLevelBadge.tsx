import { Flame } from "lucide-react";
import { SPICE_LEVEL_ICON_COUNT, SPICE_LEVEL_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function SpiceLevelBadge({
  level,
  className,
}: {
  level: string;
  className?: string;
}) {
  const count = SPICE_LEVEL_ICON_COUNT[level] ?? 0;
  if (count === 0) return null;

  return (
    <span
      title={SPICE_LEVEL_LABEL[level]}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Flame key={i} className="h-3.5 w-3.5 fill-burgundy-600 text-burgundy-600" />
      ))}
    </span>
  );
}
