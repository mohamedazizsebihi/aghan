"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ARViewer } from "@/components/dish/ARViewer";

/** Roughly 250KB of JS (three.js included), so it is worth not always paying. */
function preloadModelViewer() {
  return import("@google/model-viewer");
}

type SaveDataConnection = { saveData?: boolean; effectiveType?: string };

function shouldPreloadEagerly() {
  const connection = (navigator as Navigator & { connection?: SaveDataConnection })
    .connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return !["slow-2g", "2g"].includes(connection.effectiveType ?? "");
}

export function ARSection({
  glbUrl,
  posterUrl,
  alt,
}: {
  glbUrl: string;
  posterUrl?: string | null;
  alt: string;
}) {
  const [open, setOpen] = useState(false);
  const preloaded = useRef(false);

  const preload = useCallback(() => {
    if (preloaded.current) return;
    preloaded.current = true;
    preloadModelViewer();
  }, []);

  // Warming the module cache while the page is idle means the viewer is
  // usually already loaded by the time the button is tapped, instead of the
  // customer watching a spinner download a library. Skipped on metered or
  // slow connections, where spending 250KB on a feature nobody asked for yet
  // is the worse trade.
  useEffect(() => {
    if (!shouldPreloadEagerly()) return;
    if ("requestIdleCallback" in window) {
      const handle = window.requestIdleCallback(preload);
      return () => window.cancelIdleCallback(handle);
    }
    const timeout = setTimeout(preload, 200);
    return () => clearTimeout(timeout);
  }, [preload]);

  if (!open) {
    return (
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        onPointerEnter={preload}
        onFocus={preload}
      >
        <View className="h-4 w-4" />
        View on Your Table (AR)
      </Button>
    );
  }

  return (
    // A determinate width matters here: <model-viewer> sets `contain: strict`,
    // so it contributes nothing to its parent's intrinsic size. Inside a
    // shrink-to-fit box its width collapses to whatever its siblings happen to
    // measure — which is how the viewer ended up rendering at unpredictable
    // sizes depending on the length of the caption below it.
    <div className="w-full max-w-md">
      <ARViewer glbUrl={glbUrl} posterUrl={posterUrl} alt={alt} />
      <p className="mt-3 text-sm text-ink/50">
        Tap the gold button in the corner to place {alt} on your table, at the
        size it is actually served.
      </p>
    </div>
  );
}
