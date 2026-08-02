/**
 * One-time move of existing local uploads (dish photos, category photos, AR
 * models) into Cloudflare R2, and repoints the rows that reference them.
 *
 * Only touches rows whose URL still starts with `/api/uploads/` — the shape
 * `saveUpload()` used to return when it wrote to local disk. Rows already
 * migrated (or created after the R2 switch) are R2 URLs already and are left
 * alone, so this is safe to run more than once.
 *
 * Local files are read but never deleted — this only adds R2 copies and
 * updates the database to point at them. Clean up `uploads/` by hand once
 * you've confirmed the new URLs work.
 *
 *   npx tsx scripts/migrate-uploads-to-r2.ts            # report what would move
 *   npx tsx scripts/migrate-uploads-to-r2.ts --apply     # do it
 *
 * Requires R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY /
 * R2_PUBLIC_URL set — see .env.example.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { saveUpload, resolveUploadPath } from "../src/lib/uploads";
import { r2Enabled } from "../src/lib/r2";

const apply = process.argv.includes("--apply");
const LOCAL_PREFIX = "/api/uploads/";

function mb(bytes: number) {
  return `${(bytes / 1048576).toFixed(2)}MB`;
}

async function migrateOne(url: string): Promise<string | null> {
  const subpath = url.slice(LOCAL_PREFIX.length).split("/");
  let buffer: Buffer;
  try {
    buffer = await readFile(resolveUploadPath(subpath));
  } catch (error) {
    console.log(`    skipped, file missing on disk: ${url} (${error})`);
    return null;
  }
  console.log(`    ${url}  (${mb(buffer.length)})`);
  if (!apply) return null;
  return saveUpload(subpath, buffer);
}

async function migrateDishes() {
  const dishes = await prisma.dish.findMany({
    where: {
      OR: [
        { imageUrl: { startsWith: LOCAL_PREFIX } },
        { arModelGlbUrl: { startsWith: LOCAL_PREFIX } },
      ],
    },
  });
  console.log(`\n${dishes.length} dish(es) with a local upload:\n`);

  for (const dish of dishes) {
    console.log(`  ${dish.name}`);
    const data: { imageUrl?: string; arModelGlbUrl?: string } = {};

    if (dish.imageUrl?.startsWith(LOCAL_PREFIX)) {
      const newUrl = await migrateOne(dish.imageUrl);
      if (newUrl) data.imageUrl = newUrl;
    }
    if (dish.arModelGlbUrl?.startsWith(LOCAL_PREFIX)) {
      const newUrl = await migrateOne(dish.arModelGlbUrl);
      if (newUrl) data.arModelGlbUrl = newUrl;
    }

    if (apply && Object.keys(data).length > 0) {
      await prisma.dish.update({ where: { id: dish.id }, data });
    }
  }
}

async function migrateCategories() {
  const categories = await prisma.category.findMany({
    where: { imageUrl: { startsWith: LOCAL_PREFIX } },
  });
  console.log(`\n${categories.length} categor${categories.length === 1 ? "y" : "ies"} with a local upload:\n`);

  for (const category of categories) {
    console.log(`  ${category.name}`);
    const newUrl = await migrateOne(category.imageUrl!);
    if (apply && newUrl) {
      await prisma.category.update({ where: { id: category.id }, data: { imageUrl: newUrl } });
    }
  }
}

async function main() {
  // Only required for --apply: a dry run just reports what's local, which
  // doesn't need anywhere to send it.
  if (apply && !r2Enabled) {
    console.error(
      "R2 is not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / " +
        "R2_SECRET_ACCESS_KEY / R2_PUBLIC_URL) — nothing to migrate to. See .env.example."
    );
    process.exit(1);
  }

  await migrateDishes();
  await migrateCategories();

  console.log(apply ? "\nDone. Local files were left in place." : "\nRun with --apply to migrate.");
  await prisma.$disconnect();
}

main();
