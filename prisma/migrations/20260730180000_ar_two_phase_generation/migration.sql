-- Which Meshy task `arGenerationTaskId` currently refers to: a generation is
-- now two chained tasks (MODELING then SIZING). Existing in-flight rows have
-- NULL here and are treated as MODELING.
-- AlterTable
ALTER TABLE "Dish" ADD COLUMN "arGenerationPhase" TEXT;

-- iOS no longer uses a Meshy-built USDZ: model-viewer generates one on the fly
-- from the GLB, so the corrected real-world scale applies on both platforms
-- and there is a single file per dish to get right. The previously generated
-- .usdz files are left on disk, unreferenced.
-- AlterTable
ALTER TABLE "Dish" DROP COLUMN "arModelUsdzUrl";
