import { existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const DATABASE_URL = process.env.DATABASE_URL || "file:./prisma/dev.db";

/**
 * How long a blocked write waits for the lock before throwing SQLITE_BUSY.
 * better-sqlite3 defaults to 5s; under WAL, contention windows are short, and
 * a slow query is far better than a customer's order failing outright.
 */
const BUSY_TIMEOUT_MS = 15_000;

/**
 * Puts the database in WAL mode.
 *
 * The default journal mode is `delete`, where a writer takes an exclusive lock
 * on the whole file — every reader blocks for the duration of every write. WAL
 * lets readers carry on against the last committed snapshot while a write is in
 * flight, which is what keeps the storefront responsive while orders are being
 * placed.
 *
 * `journal_mode` is a property of the database file, not of a connection, so
 * setting it once on a throwaway connection is enough and it persists. (Almost
 * every other pragma, `synchronous` included, is per-connection and could not
 * be set this way — the driver adapter owns Prisma's own connections.)
 *
 * Failure here is deliberately non-fatal: a database that is merely slower to
 * write is much better than an app that refuses to boot.
 */
function enableWalMode(url: string) {
  const file = url.replace(/^file:/, "");
  if (file === ":memory:" || file.startsWith("file::memory:")) return;

  const resolved = path.resolve(file);
  // Before the first `prisma migrate`, the file legitimately does not exist.
  // Opening it here would create an empty database and race the migration, so
  // skip — the next boot, after migrations, applies WAL and it sticks.
  if (!existsSync(resolved)) return;

  try {
    const db = new Database(resolved);
    try {
      const mode = db.pragma("journal_mode = WAL", { simple: true });
      if (mode !== "wal") {
        console.warn(`[db] could not enable WAL (journal_mode is "${mode}")`);
      }
    } finally {
      db.close();
    }
  } catch (error) {
    console.warn("[db] could not enable WAL:", error);
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

if (!globalForPrisma.prisma) enableWalMode(DATABASE_URL);

const adapter = new PrismaBetterSqlite3({
  url: DATABASE_URL,
  timeout: BUSY_TIMEOUT_MS,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
