# syntax=docker/dockerfile:1
ARG NODE_VERSION=24-bookworm-slim

# ---------------------------------------------------------------------------
# builder: installs all dependencies (incl. devDependencies) and builds the
# app. devDependencies are kept in the final image too (see "runner" below)
# because `prisma migrate deploy` and the seed script both need the `prisma`
# CLI / `tsx` at runtime, not just at build time.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy only what `npm ci`'s postinstall (`prisma generate`) needs first, so
# this layer stays cached across builds that only change app source.
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# runner: same base image (no toolchain needed at runtime), non-root user,
# only the build output + node_modules copied over from the builder.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1001 nodejs \
    && useradd --uid 1001 --gid nodejs --create-home --shell /bin/sh nextjs

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
# Maintenance tooling has to ship too: `ar:fix` sweeps the .usdz and .glb files
# that failed generations leave behind in uploads/, and it is only reachable
# inside the running container.
COPY --from=builder /app/scripts ./scripts

COPY docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# /app/uploads (dish photos, AR models) is meant to be bind-mounted from the
# host — creating it here with the right ownership first means a fresh empty
# mount inherits that ownership instead of falling back to root.
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /app/uploads \
    && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
