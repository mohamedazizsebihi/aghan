"use client";

import { useRef } from "react";
import { Box, Camera, Sparkles } from "lucide-react";
import { ARViewer } from "@/components/dish/ARViewer";
import { useArGeneration } from "@/hooks/use-ar-generation";
import { dishSizeForCategory } from "@/lib/ar-scale";

export function ARModelUploader({
  dishId,
  dishName,
  categorySlug,
  glbUrl,
  posterUrl,
  meshyEnabled,
  initialGenerationStatus,
}: {
  dishId: string;
  dishName: string;
  categorySlug: string;
  glbUrl: string | null;
  posterUrl: string | null;
  meshyEnabled: boolean;
  initialGenerationStatus: string | null;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { isGenerating, progress, hasFailed, generate } = useArGeneration(
    dishId,
    initialGenerationStatus
  );

  const realSizeCm = Math.round(dishSizeForCategory(categorySlug) * 100);

  return (
    <div>
      {glbUrl ? (
        <ARViewer glbUrl={glbUrl} posterUrl={posterUrl} alt={dishName} />
      ) : (
        <div className="flex aspect-square w-full max-w-sm items-center justify-center rounded-xl bg-ink/5 ring-1 ring-ink/10">
          {isGenerating ? (
            <div className="flex w-full max-w-[220px] flex-col items-center gap-3 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-burgundy-700" />
              <p className="text-xs text-ink/50">
                Generating 3D model with AI — this can take a few minutes…
              </p>
              <div className="h-1 w-full overflow-hidden rounded-full bg-ink/10">
                <div
                  className="h-full rounded-full bg-burgundy-700 transition-[width] duration-700"
                  style={{ width: `${Math.max(progress, 4)}%` }}
                />
              </div>
            </div>
          ) : (
            <Box className="h-8 w-8 text-ink/25" />
          )}
        </div>
      )}

      {meshyEnabled && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-gold-400 disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            {isGenerating ? "Generating…" : "Take Photo & Generate 3D"}
          </button>
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => generate()}
            className="inline-flex items-center gap-2 rounded-full border border-gold-500 px-4 py-2 text-sm font-medium text-ink/80 transition-colors hover:bg-gold-500/10 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {isGenerating
              ? "Generating…"
              : hasFailed
                ? "Retry with Existing Photo"
                : "Use Existing Photo"}
          </button>
          <p className="w-full text-xs text-ink/40">
            &ldquo;Take Photo&rdquo; opens your camera right now — best for a
            dish fresh out of the kitchen. &ldquo;Use Existing Photo&rdquo;
            reuses the photo already on this dish.
          </p>
        </div>
      )}

      {/* The web preview always frames the model to fill the box, so it gives
          no clue about the size customers will actually see in AR. Stating
          the number is the only way to catch a mis-set category here. */}
      <p className="mt-3 text-xs text-ink/40">
        In AR this dish is placed {realSizeCm} cm across, the standard for its
        category. Adjust in <code>src/lib/ar-scale.ts</code> and regenerate to
        change it.
      </p>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) generate(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
