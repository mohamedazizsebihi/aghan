"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * False during server render and the hydration pass, true afterwards.
 *
 * Needed wherever the UI depends on the persisted cart: the server has no
 * idea what is in localStorage, so rendering the real contents straight away
 * is a hydration mismatch.
 *
 * The obvious `useState(false)` + `useEffect(() => setHydrated(true))` does
 * the same thing, but setting state from an effect body schedules a second
 * render pass that React (and the compiler's lint rule) rightly flags.
 * useSyncExternalStore expresses "this value differs between server and
 * client" directly, with no extra pass.
 */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, onClient, onServer);
}
