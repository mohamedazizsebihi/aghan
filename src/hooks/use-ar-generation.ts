"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_MINUTES = 10;
const MAX_POLL_ATTEMPTS = (MAX_POLL_MINUTES * 60_000) / POLL_INTERVAL_MS;

type ServerState = {
  status: "IDLE" | "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED";
  progress?: number;
  error?: string;
};

type ArState =
  | { phase: "idle" }
  /** POST in flight: the UI is busy, but there is nothing to poll yet. */
  | { phase: "starting" }
  | { phase: "running"; progress: number }
  | { phase: "failed" };

function initialState(status: string | null): ArState {
  if (status === "PENDING" || status === "IN_PROGRESS") {
    return { phase: "running", progress: 0 };
  }
  return status === "FAILED" ? { phase: "failed" } : { phase: "idle" };
}

/**
 * Drives one dish's AI model generation: kicks it off, then polls until the
 * server-side state machine finishes.
 *
 * Polling deliberately starts only once the POST has resolved. Starting it
 * optimistically raced the request that registers the Meshy task id — if the
 * upload took longer than one poll interval the first poll saw "no task
 * running", concluded nothing was happening, and silently gave up while the
 * generation carried on.
 */
export function useArGeneration(dishId: string, initialStatus: string | null) {
  const router = useRouter();
  const [state, setState] = useState<ArState>(() => initialState(initialStatus));
  const isRunning = state.phase === "running";

  useEffect(() => {
    if (!isRunning) return;

    let cancelled = false;
    // Held here rather than in state so that progress updates — which are the
    // whole point of polling — do not tear down and restart the interval,
    // resetting the timeout budget with it.
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts += 1;
      if (attempts > MAX_POLL_ATTEMPTS) {
        clearInterval(interval);
        setState({ phase: "failed" });
        toast.error(
          `Generation is still not done after ${MAX_POLL_MINUTES} minutes. Please try again.`
        );
        return;
      }

      let data: ServerState;
      try {
        const res = await fetch(`/api/dishes/${dishId}/ar-generate`, {
          cache: "no-store",
        });
        data = await res.json();
      } catch {
        return; // transient network error, keep polling
      }
      if (cancelled) return;

      if (data.status === "SUCCEEDED") {
        setState({ phase: "idle" });
        toast.success("3D model generated");
        router.refresh();
      } else if (data.status === "FAILED") {
        setState({ phase: "failed" });
        toast.error(data.error || "Generation failed");
      } else if (data.status === "IDLE") {
        setState({ phase: "idle" });
      } else {
        setState({ phase: "running", progress: data.progress ?? 0 });
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isRunning, dishId, router]);

  const generate = useCallback(
    async (photo?: File) => {
      let body: FormData | undefined;
      if (photo) {
        body = new FormData();
        body.append("file", photo);
      }

      setState({ phase: "starting" });
      try {
        const res = await fetch(`/api/dishes/${dishId}/ar-generate`, {
          method: "POST",
          body,
        });
        const data: ServerState = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not start generation");
        setState({ phase: "running", progress: data.progress ?? 0 });
      } catch (error) {
        setState({ phase: "idle" });
        toast.error(
          error instanceof Error ? error.message : "Could not start generation"
        );
      }
    },
    [dishId]
  );

  return {
    isGenerating: isRunning || state.phase === "starting",
    progress: state.phase === "running" ? state.progress : 0,
    hasFailed: state.phase === "failed",
    generate,
  };
}
