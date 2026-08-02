/**
 * Prints the real-world size of a .glb, in centimetres.
 *
 * The web viewer always frames a model to fill its box, so it cannot show you
 * that a dish is half the size it should be — this can. Point it at the files
 * in uploads/models/dishes/glb/ to check what customers actually see in AR.
 *
 *   npm run glb:inspect -- uploads/models/dishes/glb/*.glb
 */
import { readFile } from "node:fs/promises";
import { parseGlb, measureBounds } from "../src/lib/glb";

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: npm run glb:inspect -- <file.glb> [more.glb ...]");
    process.exit(1);
  }

  for (const file of files) {
    try {
      const buffer = await readFile(file);
      const { size, longestSide } = measureBounds(parseGlb(buffer).json);
      const cm = size.map((v) => (v * 100).toFixed(1));
      console.log(
        `${file}\n  ${cm[0]} x ${cm[1]} x ${cm[2]} cm  (longest ${(longestSide * 100).toFixed(1)} cm)` +
          `  ${(buffer.length / 1024 / 1024).toFixed(2)} MB`
      );
    } catch (error) {
      console.error(`${file}\n  could not be read: ${(error as Error).message}`);
    }
  }
}

main();
