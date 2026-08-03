import "dotenv/config";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { prisma } from "../src/lib/prisma";
import type { Prisma } from "../src/generated/prisma/client";

/**
 * One-time cutover script: copies every row out of the old SQLite database
 * into the new Postgres database (already pointed to by DATABASE_URL / the
 * app's Prisma client, since the schema has moved to `provider = "postgresql"`
 * by the time this runs). Not part of the regular maintenance tooling in this
 * directory — run once during the SQLite → Postgres migration, then forget
 * about it.
 *
 * Uses `node:sqlite` (built into Node, no install, no native compile step) to
 * read the old file rather than `better-sqlite3` — the app no longer depends
 * on it, and the runtime image no longer carries the toolchain to build it
 * from source.
 *
 * SQLite has no native boolean or FK-checked datetime type: Prisma's SQLite
 * connector stored booleans as 0/1 integers and datetimes as ISO-8601 text.
 * Those need converting on the way in; Postgres has real `boolean` and
 * `timestamp` types and Prisma expects real `boolean`/`Date` values.
 *
 * All ids are pre-existing `String` cuids, so they carry over verbatim — no
 * remapping needed anywhere, including on foreign keys.
 *
 * Usage:
 *   OLD_SQLITE_PATH=./data/prod.db npx tsx scripts/migrate-sqlite-to-postgres.ts
 */

const OLD_SQLITE_PATH = process.env.OLD_SQLITE_PATH ?? "./data/prod.db";

function toBool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return Number(value) === 1;
}

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  return new Date(value as string);
}

type SqliteRow = Record<string, SQLOutputValue>;

/**
 * Applies `toBool`/`toDate` to the named columns of every row, leaving the
 * rest untouched, and hands back rows typed as whatever Prisma model input
 * `T` the caller is about to pass to `createMany`.
 *
 * The cast is real work, not a formality: `node:sqlite` has no idea what
 * shape a row is (`SQLOutputValue` is the same loose type for every column
 * of every table), so nothing narrower than an explicit assertion here would
 * ever satisfy Prisma's generated, per-model input types.
 */
function mapRows<T>(
  rows: SqliteRow[],
  boolColumns: string[],
  dateColumns: string[]
): T[] {
  return rows.map((row) => {
    const mapped = { ...row };
    for (const col of boolColumns) mapped[col] = toBool(row[col]) as unknown as SQLOutputValue;
    for (const col of dateColumns) mapped[col] = toDate(row[col]) as unknown as SQLOutputValue;
    return mapped as unknown as T;
  });
}

async function main() {
  const old = new DatabaseSync(OLD_SQLITE_PATH, { readOnly: true });

  try {
    const category = old.prepare("SELECT * FROM Category").all();
    const table = old.prepare(`SELECT * FROM "Table"`).all();
    const admin = old.prepare("SELECT * FROM Admin").all();
    const dish = old.prepare("SELECT * FROM Dish").all();
    const order = old.prepare(`SELECT * FROM "Order"`).all();
    const orderItem = old.prepare("SELECT * FROM OrderItem").all();
    const review = old.prepare("SELECT * FROM Review").all();

    console.log(
      `Read from SQLite: ${category.length} categories, ${table.length} tables, ` +
        `${admin.length} admins, ${dish.length} dishes, ${order.length} orders, ` +
        `${orderItem.length} order items, ${review.length} reviews.`
    );

    // FK-safe order: Category, Table, Admin have no dependencies; Dish
    // depends on Category; Order and OrderItem depend on each other's
    // parents; Review is standalone.
    await prisma.$transaction(async (tx) => {
      if (category.length) {
        await tx.category.createMany({
          data: mapRows<Prisma.CategoryCreateManyInput>(category, [], ["createdAt", "updatedAt"]),
        });
      }
      if (table.length) {
        await tx.table.createMany({
          data: mapRows<Prisma.TableCreateManyInput>(
            table,
            ["isActive"],
            ["createdAt", "updatedAt", "deletedAt"]
          ),
        });
      }
      if (admin.length) {
        await tx.admin.createMany({
          data: mapRows<Prisma.AdminCreateManyInput>(admin, [], ["createdAt"]),
        });
      }
      if (dish.length) {
        await tx.dish.createMany({
          data: mapRows<Prisma.DishCreateManyInput>(
            dish,
            ["isPopular", "isAvailable"],
            ["createdAt", "updatedAt"]
          ),
        });
      }
      if (order.length) {
        await tx.order.createMany({
          data: mapRows<Prisma.OrderCreateManyInput>(order, [], ["createdAt", "updatedAt"]),
        });
      }
      if (orderItem.length) {
        await tx.orderItem.createMany({
          data: orderItem as unknown as Prisma.OrderItemCreateManyInput[],
        });
      }
      if (review.length) {
        await tx.review.createMany({
          data: mapRows<Prisma.ReviewCreateManyInput>(review, ["isPublished"], ["createdAt"]),
        });
      }
    });

    console.log("Migration complete.");
  } finally {
    old.close();
  }
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
