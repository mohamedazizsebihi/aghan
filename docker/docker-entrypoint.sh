#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."

# `depends_on: condition: service_healthy` already gates this on Postgres's
# own pg_isready healthcheck, so this loop is a belt-and-suspenders fallback,
# not the primary readiness mechanism: pg_isready can report healthy a beat
# before the specific user/database Prisma connects as is actually ready.
# `prisma migrate deploy` fails fast and cleanly when Postgres isn't reachable
# yet, so retrying it directly needs no extra client tooling in this image.
attempt=0
max_attempts=10
until npx prisma migrate deploy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "[entrypoint] prisma migrate deploy failed after $max_attempts attempts" >&2
    exit 1
  fi
  echo "[entrypoint] migrate deploy failed (attempt $attempt/$max_attempts), retrying in 3s..."
  sleep 3
done

echo "[entrypoint] Starting: $*"
exec "$@"
