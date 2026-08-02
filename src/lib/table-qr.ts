/**
 * Table QR codes — one printable code per table, each pointing at the public
 * menu with its table number attached.
 *
 * These helpers are deliberately pure (no `window`, no `process.env` reads) so
 * the component can call them during both the server render and the client
 * render and get the same answer from the same inputs.
 */

/**
 * A sanity bound on table numbers, not a business rule.
 *
 * Which tables actually exist lives in the `Table` model — a number inside this
 * range is still refused at checkout unless there is an active table with it
 * (see buildOrderFromCart). This only stops absurd input reaching the database.
 */
export const MAX_TABLE_COUNT = 100;

/**
 * Last resort only, for the odd case where neither the configured base URL nor
 * the address the admin is browsing on is usable. This is the LAN address the
 * restaurant's server currently answers on.
 */
export const FALLBACK_BASE_URL = "http://192.168.1.11:3000";

/** Trailing slashes would produce `//menu`, which some scanners mangle. */
export function normaliseBaseUrl(raw: string) {
  return raw.trim().replace(/\/+$/, "");
}

/**
 * A QR code is scanned by a *phone*, not by this machine — so "localhost" and
 * friends resolve to the phone itself and the menu never loads. Detecting that
 * matters because `NEXT_PUBLIC_BASE_URL` ships as `http://localhost:3000` in
 * the default `.env`, which is correct for Stripe redirects (the browser making
 * them is on this machine) and silently wrong for these codes.
 */
export function isLoopbackUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      /^127\./.test(hostname)
    );
  } catch {
    // Half-typed input in the edit field. Not provably unreachable, so don't
    // warn about it — `isValidBaseUrl` is what rejects it.
    return false;
  }
}

export function isValidBaseUrl(url: string) {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Picks the address to bake into the codes, preferring the first candidate a
 * phone can actually reach:
 *
 *   1. `NEXT_PUBLIC_BASE_URL` — set deliberately, and the right answer once
 *      there's a real domain.
 *   2. The address the admin is browsing on. If the owner opened this page at
 *      `http://192.168.1.11:3000/admin/tables`, that origin is by definition
 *      reachable from the network the phones are on, and it keeps working when
 *      the router hands out a different IP.
 *   3. The hardcoded LAN fallback.
 *
 * Loopback and malformed candidates are skipped rather than trusted (see
 * `isLoopbackUrl`). Because the fallback is itself a valid, non-loopback
 * address, this always returns something a phone can reach — so the UI's
 * "won't work on a phone" warning only ever fires on a value an admin typed in
 * by hand, never on what was auto-detected.
 */
export function resolveQrBaseUrl(
  envBaseUrl: string | undefined,
  windowOrigin: string | null
) {
  const candidates = [envBaseUrl, windowOrigin, FALLBACK_BASE_URL]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normaliseBaseUrl)
    .filter(isValidBaseUrl);

  return candidates.find((candidate) => !isLoopbackUrl(candidate)) ?? FALLBACK_BASE_URL;
}

/**
 * The URL a table's QR code encodes. The `table` parameter is what starts a
 * dine-in session on the menu — see TableSessionCapture.
 */
export function tableMenuUrl(baseUrl: string, tableNumber: number) {
  return `${normaliseBaseUrl(baseUrl)}/menu?table=${tableNumber}`;
}

/**
 * Reads the `table` query parameter a QR code lands on.
 *
 * Shape only — whether that table exists is a separate, asynchronous question
 * the caller answers against the database. Anything that isn't a whole number
 * in range is treated as absent rather than as an error: the parameter is just
 * a URL anyone can edit, and the right answer to `?table=abc` is an ordinary
 * takeaway menu, not a broken page. Next.js hands over `string[]` when a
 * parameter is repeated (`?table=1&table=2`), which is equally untrustworthy.
 */
export function parseTableParam(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string") return null;
  if (!/^\d+$/.test(raw.trim())) return null;

  const value = Number(raw);
  if (value < 1 || value > MAX_TABLE_COUNT) return null;
  return value;
}

/**
 * Clamps a typed table count into range, or null if it isn't a number at all.
 *
 * Null rather than a default: the old version substituted a fallback whenever
 * the field was empty, which made the box impossible to clear — backspacing to
 * retype jumped straight back to a number.
 */
export function clampTableCount(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.min(MAX_TABLE_COUNT, Math.max(1, Math.floor(value)));
}
