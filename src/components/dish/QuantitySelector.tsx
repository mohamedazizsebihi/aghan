"use client";

import { Minus, Plus } from "lucide-react";

export function QuantitySelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-4 rounded-full border border-ink/15 px-3 py-2">
      <button
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-ink/5"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-6 text-center text-lg font-semibold text-ink">
        {value}
      </span>
      <button
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(20, value + 1))}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-ink/5"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
