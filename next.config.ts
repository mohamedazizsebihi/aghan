import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server (bound to 0.0.0.0 by default) accept requests coming
  // through the LAN/HTTPS proxy in nginx/lan-test/, so the site can be opened
  // on a real phone while still in `npm run dev`. Without this, Next.js
  // blocks cross-origin dev requests by default.
  // See nginx/lan-test/san.cnf if this IP ever changes, and add your tunnel
  // hostname here when testing AR (README → "Testing AR on a real phone").
  allowedDevOrigins: ["192.168.1.11", "bagh-e-kabul.local"],

  images: {
    // Dish and category photos now live in Cloudflare R2 and are rendered
    // through next/image with an absolute URL, which Next refuses to optimize
    // from an unlisted host.
    //
    // This can't be read from process.env.R2_PUBLIC_URL: unlike Stripe's
    // redirect URLs (see src/lib/base-url.ts), remotePatterns is serialized
    // into required-server-files.json at `next build` time and reused as-is
    // by `next start` — verified by inspecting that file after a build. An
    // env var would work in dev (next.config.ts is re-read on `next dev`
    // startup) and silently stop working in the built Docker image. Changing
    // the R2 public domain — including moving from the r2.dev subdomain to a
    // custom domain — means editing this value and rebuilding, not just
    // changing an env var.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-c398d3c783734225ba3b1553583277d2.r2.dev",
      },
    ],
  },
};

export default nextConfig;
