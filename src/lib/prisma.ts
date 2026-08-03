import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  // Postgres uses MVCC, not SQLite's whole-file exclusive writer lock, so
  // there's no reason to wait long for a connection the way the old
  // SQLite adapter's 15s BUSY_TIMEOUT_MS did. Fail fast instead: a slow
  // timeout here would mask a genuinely unreachable database as a hang.
  connectionTimeoutMillis: 5_000,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

/**
 * Cached on `globalThis` unconditionally — including in production, unlike
 * the NODE_ENV-gated pattern shown in most Prisma examples.
 *
 * Next.js bundles the RSC and SSR layers into separate chunks even in a
 * production build (verified: two distinct compiled copies of this file
 * under `.next/server/chunks/`), so a production-only guard here silently
 * created two live PrismaClients — and two separate connection pools — in
 * the same process. `src/lib/order-events.ts` and `src/lib/rate-limit.ts`
 * pin their own per-process state to `globalThis` the same way, for the
 * same reason.
 */
globalForPrisma.prisma = prisma;
