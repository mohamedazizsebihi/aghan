import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 speaks the S3 API, so the official AWS SDK talks to it
 * directly once pointed at R2's account-scoped endpoint with region "auto" —
 * no Cloudflare-specific client exists or is needed.
 *
 * Kept lazy (constructed on first use, not at module load) so that importing
 * this file never throws — only actually trying to upload or delete something
 * without credentials configured does, with a message that says what's
 * missing instead of a raw SDK stack trace.
 */

export const R2_BUCKET = process.env.R2_BUCKET || "afghan";

/**
 * The bucket's public base URL: either the `pub-*.r2.dev` subdomain Cloudflare
 * generates for a public bucket, or a custom domain mapped to it. No trailing
 * slash — stored URLs are built as `${R2_PUBLIC_URL}/${key}`.
 *
 * Cloudflare's own docs mark the r2.dev subdomain as fine for development but
 * not guaranteed for production traffic; a custom domain is one bucket setting
 * away and only requires updating this value (plus the image host allowlist in
 * next.config.ts — see the comment there for why that one needs a rebuild).
 */
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

function missingConfig() {
  const missing = [
    !process.env.R2_ACCOUNT_ID && "R2_ACCOUNT_ID",
    !process.env.R2_ACCESS_KEY_ID && "R2_ACCESS_KEY_ID",
    !process.env.R2_SECRET_ACCESS_KEY && "R2_SECRET_ACCESS_KEY",
    !R2_PUBLIC_URL && "R2_PUBLIC_URL",
  ].filter(Boolean);
  return missing.length > 0 ? missing.join(", ") : null;
}

export const r2Enabled = missingConfig() === null;

let client: S3Client | null = null;

/** Throws with the exact missing env var names rather than failing deep inside an SDK call. */
export function getR2Client(): S3Client {
  const missing = missingConfig();
  if (missing) {
    throw new Error(`Cloudflare R2 is not configured. Missing: ${missing}.`);
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}
