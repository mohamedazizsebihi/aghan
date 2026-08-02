"use client";

import { useEffect, useRef, useState } from "react";
import { View } from "lucide-react";

/**
 * Scene Viewer (Android/ARCore) and Quick Look (iOS/ARKit) do plane detection
 * natively and lock onto a surface almost instantly. In-browser WebXR — which
 * model-viewer would try first by default — is slower to find a surface and
 * renders choppier, so the native app is preferred on every platform that has
 * one and WebXR is the fallback.
 */
const AR_MODES = "scene-viewer quick-look webxr";

type Hint = { tone: "info" | "error"; message: string } | null;

const HINTS = {
  notTracking: {
    tone: "info",
    message:
      "Point your camera at a well-lit table and move the phone slowly so it can find the surface.",
  },
  arFailed: {
    tone: "error",
    message:
      "Couldn't start AR on this device. On Android, check that Google Play Services for AR is installed and up to date.",
  },
  loadFailed: {
    tone: "error",
    message: "Couldn't load the 3D model. Check your connection and try again.",
  },
} satisfies Record<string, NonNullable<Hint>>;

export function ARViewer({
  glbUrl,
  posterUrl,
  alt,
}: {
  glbUrl: string;
  posterUrl?: string | null;
  alt: string;
}) {
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState<Hint>(null);
  const viewerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer").then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Without these, a failed AR hand-off is completely silent: the button does
  // nothing, or the camera opens and never places anything, and the customer
  // has no idea whether it is their phone, the lighting, or the site.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const onStatus = (event: Event) => {
      const status = (event as CustomEvent<{ status: string }>).detail.status;
      if (status === "failed") setHint(HINTS.arFailed);
      if (status === "object-placed" || status === "not-presenting") setHint(null);
    };
    const onTracking = (event: Event) => {
      const status = (event as CustomEvent<{ status: string }>).detail.status;
      setHint(status === "not-tracking" ? HINTS.notTracking : null);
    };
    const onError = () => setHint(HINTS.loadFailed);

    viewer.addEventListener("ar-status", onStatus);
    viewer.addEventListener("ar-tracking", onTracking);
    viewer.addEventListener("error", onError);
    return () => {
      viewer.removeEventListener("ar-status", onStatus);
      viewer.removeEventListener("ar-tracking", onTracking);
      viewer.removeEventListener("error", onError);
    };
  }, [ready]);

  if (!ready) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-3xl bg-ink/5">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-burgundy-700" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-3xl bg-ink/5 shadow-xl shadow-ink/10">
        <model-viewer
          ref={viewerRef}
          src={glbUrl}
          alt={alt}
          poster={posterUrl ?? undefined}
          ar
          ar-modes={AR_MODES}
          // The GLB is authored at the dish's real size (see lib/ar-scale.ts),
          // so "fixed" is what makes AR show a true portion instead of an
          // object the customer can pinch to any size they like.
          ar-scale="fixed"
          ar-placement="floor"
          // Lets WebXR light the model with the real camera feed, so the
          // fallback path doesn't look pasted on.
          xr-environment
          camera-controls
          // model-viewer defaults to touch-action:none, which swallows
          // vertical swipes and makes the page impossible to scroll past on a
          // phone. pan-y gives scrolling back and still allows drag-to-rotate.
          touch-action="pan-y"
          auto-rotate
          rotation-per-second="20deg"
          shadow-intensity="1"
          environment-image="neutral"
          exposure="1.1"
          className="block h-auto w-full"
          style={
            {
              aspectRatio: "1 / 1",
              "--poster-color": "transparent",
            } as React.CSSProperties
          }
        >
          <button
            slot="ar-button"
            className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-gold-500 px-4 py-2.5 text-sm font-medium text-ink shadow-lg transition-colors hover:bg-gold-400"
          >
            <View className="h-4 w-4" />
            View on Your Table
          </button>
        </model-viewer>
      </div>

      {hint && (
        <p
          role="status"
          className={
            hint.tone === "error"
              ? "mt-3 text-sm text-burgundy-700"
              : "mt-3 text-sm text-ink/60"
          }
        >
          {hint.message}
        </p>
      )}
    </div>
  );
}
