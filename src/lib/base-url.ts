import { headers } from "next/headers";

import { isValidBaseUrl, normaliseBaseUrl } from "@/lib/table-qr";

/**
 * The public origin of this deployment, resolved at REQUEST time.
 *
 * `NEXT_PUBLIC_*` is substituted into the bundle during `next build`, so a value
 * that is only known at deploy time cannot travel that way — and `.dockerignore`
 * excludes `.env*`, so the image is built with whatever the default was. Stripe
 * redirect URLs built from `NEXT_PUBLIC_BASE_URL` were therefore baked as
 * `http://localhost:3000`: the customer paid, then landed on a dead address.
 *
 * `APP_BASE_URL` is a server-only variable, so it is read from the container's
 * real environment on every request and can be changed without rebuilding.
 */
const CONFIGURED_BASE_URL = "APP_BASE_URL";

/**
 * Kept as a fallback only so an existing deployment that still sets the old
 * variable keeps working. Prefer `APP_BASE_URL`.
 */
const LEGACY_BASE_URL = "NEXT_PUBLIC_BASE_URL";

function fromEnv() {
  for (const key of [CONFIGURED_BASE_URL, LEGACY_BASE_URL]) {
    const raw = process.env[key];
    if (!raw) continue;
    const url = normaliseBaseUrl(raw);
    if (isValidBaseUrl(url)) return url;
  }
  return null;
}

/**
 * Derived from the request nginx forwarded. Correct for any host the site is
 * actually reachable on, which is what a redirect target needs to be — but only
 * trustworthy because nginx sets both headers itself (see
 * nginx/conf.d/default.conf); they are attacker-controlled on a direct hit.
 */
async function fromForwardedRequest() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;

  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = normaliseBaseUrl(`${proto}://${host}`);
  return isValidBaseUrl(url) ? url : null;
}

/**
 * Resolve the origin to build absolute URLs from (Stripe redirects, QR codes).
 *
 * Configuration wins over the request host so that a deployment reachable on
 * several hostnames still sends customers to the canonical one.
 */
export async function resolveBaseUrl() {
  return fromEnv() ?? (await fromForwardedRequest());
}

/**
 * For call sites that cannot proceed without an absolute URL — sending a
 * customer to Stripe with a relative `success_url` silently strands them.
 */
export async function requireBaseUrl() {
  const baseUrl = await resolveBaseUrl();
  if (!baseUrl) {
    throw new Error(
      `Cannot resolve the site's public URL. Set ${CONFIGURED_BASE_URL} in the environment.`,
    );
  }
  return baseUrl;
}
