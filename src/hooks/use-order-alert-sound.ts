"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const PREFERENCE_KEY = "bagh-e-kabul-order-sound";

/**
 * The preference is read straight from localStorage through
 * `useSyncExternalStore` rather than mirrored into state by an effect.
 *
 * Same reasoning as `useHydrated`: the value genuinely differs between the
 * server render and the client, and seeding state from an effect schedules a
 * second render pass that React's lint rule flags. localStorage has no change
 * event of its own for same-document writes, so the toggle notifies subscribers.
 */
const preferenceListeners = new Set<() => void>();

function subscribePreference(onChange: () => void) {
  preferenceListeners.add(onChange);
  return () => preferenceListeners.delete(onChange);
}

function readPreference() {
  return window.localStorage.getItem(PREFERENCE_KEY) === "on";
}

/** The server cannot know, and must not guess "on" — that would beep on load. */
function readPreferenceOnServer() {
  return false;
}

function writePreference(value: boolean) {
  window.localStorage.setItem(PREFERENCE_KEY, value ? "on" : "off");
  for (const listener of preferenceListeners) listener();
}

type WebAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

/**
 * A short chime for new orders.
 *
 * Synthesised with the Web Audio API rather than played from a file: no asset
 * to ship, nothing to decode, and no format that some browser refuses.
 *
 * The awkward part is not the sound, it is permission. Browsers refuse to start
 * audio until the user has interacted with the page, and an `AudioContext`
 * created before that starts suspended — so a kitchen tablet left open would
 * beep silently. Hence an explicit toggle: the click that turns it on is itself
 * the gesture that unlocks audio. The preference is remembered, but a reload
 * still needs a gesture, so any later click on the page resumes it.
 */
export function useOrderAlertSound() {
  const enabled = useSyncExternalStore(
    subscribePreference,
    readPreference,
    readPreferenceOnServer
  );
  const contextRef = useRef<AudioContext | null>(null);

  const ensureContext = useCallback(() => {
    if (!contextRef.current) {
      const Ctor =
        window.AudioContext ?? (window as WebAudioWindow).webkitAudioContext;
      if (!Ctor) return null;
      contextRef.current = new Ctor();
    }
    if (contextRef.current.state === "suspended") {
      void contextRef.current.resume();
    }
    return contextRef.current;
  }, []);

  /**
   * After a reload the preference says "on" but the context is locked again.
   * The next click anywhere is a valid gesture, so use it and stop listening.
   */
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => ensureContext();
    document.addEventListener("click", unlock, { once: true });
    return () => document.removeEventListener("click", unlock);
  }, [enabled, ensureContext]);

  useEffect(() => {
    return () => {
      void contextRef.current?.close();
      contextRef.current = null;
    };
  }, []);

  const play = useCallback(() => {
    if (!enabled) return;
    const context = ensureContext();
    if (!context || context.state !== "running") return;

    // Two rising notes — audible over a kitchen without being an alarm.
    const start = context.currentTime;
    for (const [index, frequency] of [880, 1320].entries()) {
      const at = start + index * 0.14;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, at);

      // Ramps rather than steps: an instant cut produces an audible click.
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.15);
    }
  }, [enabled, ensureContext]);

  const toggle = useCallback(() => {
    const next = !readPreference();
    writePreference(next);
    // Called from a click handler, so this is the gesture that unlocks audio.
    if (next) ensureContext();
  }, [ensureContext]);

  return { enabled, toggle, play };
}
