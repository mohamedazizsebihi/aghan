import { cn } from "@/lib/utils";

type Tone = "gold" | "green" | "burgundy" | "neutral";

const toneClasses: Record<Tone, string> = {
  gold: "bg-gold-500/15 text-gold-700 border-gold-500/30",
  green: "bg-green-800/10 text-green-800 border-green-800/25",
  burgundy: "bg-burgundy-700/10 text-burgundy-700 border-burgundy-700/25",
  neutral: "bg-ink/5 text-ink/70 border-ink/15",
};

export function Badge({
  children,
  tone = "gold",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wider",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
