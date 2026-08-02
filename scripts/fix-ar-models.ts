/**
 * Brings the AR models already on disk in line with what the pipeline now
 * guarantees: the real-world size for their dish's category, and textures
 * re-encoded for delivery. Then deletes model files nothing points at.
 *
 * Models generated before src/lib/ar-scale.ts existed were sized by Meshy's
 * AI estimate and came out anywhere from a third to seven times off. This
 * fixes them in place, without spending Meshy credits — though it cannot add
 * detail that was never generated, so a model made before the 4K PBR settings
 * still needs regenerating to look its best.
 *
 *   npm run ar:fix            # report what would change
 *   npm run ar:fix -- --apply # do it
 */
import "dotenv/config";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { prepareGlbForAr, parseGlb, measureBounds } from "../src/lib/glb";
import { dishSizeForCategory } from "../src/lib/ar-scale";
import {
  saveUpload,
  readUploadFromUrl,
  listUploadKeys,
  deleteUploadKey,
  UPLOADS_DIR,
} from "../src/lib/uploads";

const apply = process.argv.includes("--apply");
const MODELS_DIR = path.join(UPLOADS_DIR, "models", "dishes");
const cm = (m: number) => `${(m * 100).toFixed(1)}cm`;
const mb = (bytes: number) => `${(bytes / 1048576).toFixed(2)}MB`;

/**
 * Files this run has just replaced. They are left alone by the orphan sweep
 * so that a bad rewrite can still be pointed back at; the next run, once the
 * new model has been eyeballed, will collect them.
 */
const justReplaced = new Set<string>();

async function resizeExistingModels() {
  const dishes = await prisma.dish.findMany({
    where: { arModelGlbUrl: { not: null } },
    include: { category: true },
  });

  console.log(`\n${dishes.length} dish(es) with a model:\n`);

  for (const dish of dishes) {
    const target = dishSizeForCategory(dish.category.slug);
    const currentKey = dish.arModelGlbUrl!.split("/").pop()!;

    let source: Buffer;
    try {
      source = await readUploadFromUrl(dish.arModelGlbUrl!);
    } catch {
      console.log(`  ${dish.name}: file missing (${dish.arModelGlbUrl})`);
      continue;
    }

    const before = measureBounds(parseGlb(source).json);
    const prepared = await prepareGlbForAr(source, target);
    const worthRewriting =
      prepared.scaleCorrection !== 1 || prepared.bytesAfter < source.length * 0.95;

    console.log(
      `  ${dish.name} [${dish.category.slug}]\n` +
        `    size ${cm(before.longestSide)} -> ${cm(target)}` +
        `    weight ${mb(source.length)} -> ${mb(prepared.bytesAfter)}`
    );

    if (!worthRewriting) {
      console.log("    already correct, skipped");
      continue;
    }
    if (!apply) {
      console.log("    would rewrite (run with --apply)");
      continue;
    }

    const url = await saveUpload(
      ["models", "dishes", "glb", `${dish.slug}-${Date.now()}.glb`],
      prepared.buffer
    );
    await prisma.dish.update({ where: { id: dish.id }, data: { arModelGlbUrl: url } });
    justReplaced.add(currentKey);
    console.log(`    rewritten -> ${url}`);
  }
}

/**
 * Sweeps both places a model file can be: R2, where every generation since the
 * move has landed, and the local `uploads/` dir, for whatever hadn't been
 * migrated yet. A dish's row points at exactly one of the two, so nothing here
 * cares which — only whether a file's basename is referenced by any row.
 */
async function sweepOrphans() {
  const referenced = new Set(
    (
      await prisma.dish.findMany({
        where: { arModelGlbUrl: { not: null } },
        select: { arModelGlbUrl: true },
      })
    ).map((dish) => dish.arModelGlbUrl!.split("/").pop()!)
  );
  const isOrphan = (basename: string) =>
    !referenced.has(basename) && !justReplaced.has(basename);

  const localOrphans: { file: string; bytes: number }[] = [];
  // Every .usdz is an orphan now: iOS gets a USDZ generated on the fly from
  // the GLB instead, so the column that referenced them is gone.
  for (const kind of ["glb", "usdz"]) {
    const dir = path.join(MODELS_DIR, kind);
    for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isFile() || !isOrphan(entry.name)) continue;
      const file = path.join(dir, entry.name);
      localOrphans.push({ file, bytes: (await stat(file)).size });
    }
  }

  const r2Orphans: { key: string; bytes: number }[] = [];
  for (const kind of ["glb", "usdz"]) {
    const objects = await listUploadKeys(`models/dishes/${kind}/`).catch((error) => {
      console.error(`  Could not list R2 objects under models/dishes/${kind}/:`, error);
      return [];
    });
    for (const obj of objects) {
      if (isOrphan(obj.key.split("/").pop()!)) {
        r2Orphans.push({ key: obj.key, bytes: obj.bytes });
      }
    }
  }

  const total =
    localOrphans.reduce((sum, o) => sum + o.bytes, 0) +
    r2Orphans.reduce((sum, o) => sum + o.bytes, 0);
  console.log(
    `\n${localOrphans.length + r2Orphans.length} unreferenced model file(s), ${mb(total)}:\n`
  );
  for (const orphan of localOrphans) {
    console.log(`  ${path.relative(process.cwd(), orphan.file)}  ${mb(orphan.bytes)}`);
    if (apply) await unlink(orphan.file);
  }
  for (const orphan of r2Orphans) {
    console.log(`  r2://${orphan.key}  ${mb(orphan.bytes)}`);
    if (apply) await deleteUploadKey(orphan.key);
  }
  if (justReplaced.size) {
    console.log(
      `\n  (${justReplaced.size} file(s) replaced in this run were kept as a fallback)`
    );
  }
  console.log(apply ? "  deleted." : "  run with --apply to delete.");
}

async function main() {
  await resizeExistingModels();
  await sweepOrphans();
  await prisma.$disconnect();
}

main();
