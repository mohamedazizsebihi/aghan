import { prisma } from "@/lib/prisma";
import {
  createModelingTask,
  createSizingTask,
  getTask,
  type MeshyPhase,
} from "@/lib/meshy";
import { dishSizeForCategory } from "@/lib/ar-scale";
import { prepareGlbForAr } from "@/lib/glb";
import { saveUpload, deleteUpload } from "@/lib/uploads";

/**
 * Server-side state machine for "photo in, correctly-sized AR model out".
 *
 * A generation runs as two chained Meshy tasks (MODELING then SIZING, see
 * meshy.ts). The dish row is the only persistence: `arGenerationTaskId` holds
 * the task currently being waited on and `arGenerationPhase` says which
 * endpoint it belongs to, so a page reload — or a different admin on another
 * device — resumes the same generation rather than starting a second one.
 */

export type ArGenerationState =
  | { status: "IDLE" }
  | { status: "PENDING" | "IN_PROGRESS"; progress: number }
  | { status: "SUCCEEDED" }
  | { status: "FAILED"; error: string };

/**
 * Meshy reports progress per task. Modeling is the slow phase (minutes) and
 * sizing is near-instant, so the two are folded into one honest 0-100 bar
 * instead of letting it reset to zero halfway through.
 */
const PHASE_PROGRESS_SHARE: Record<MeshyPhase, { from: number; to: number }> = {
  MODELING: { from: 0, to: 90 },
  SIZING: { from: 90, to: 100 },
};

function overallProgress(phase: MeshyPhase, taskProgress: number) {
  const { from, to } = PHASE_PROGRESS_SHARE[phase];
  return Math.round(from + ((to - from) * (taskProgress ?? 0)) / 100);
}

/**
 * Downloads the finished model and makes it fit to serve: verified to the
 * real-world size we asked for, and with its 4K PBR maps re-encoded down to
 * something a phone will actually pull over mobile data.
 */
async function storeGlb(remoteUrl: string, slug: string, targetSizeM: number) {
  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error("Failed to download the generated model from Meshy");

  const prepared = await prepareGlbForAr(
    Buffer.from(await res.arrayBuffer()),
    targetSizeM
  );
  const cm = prepared.dimensions.map((v) => (v * 100).toFixed(1)).join(" x ");
  console.info(
    `[ar] ${slug}: ${cm} cm, ` +
      `${(prepared.bytesBefore / 1048576).toFixed(1)}MB -> ` +
      `${(prepared.bytesAfter / 1048576).toFixed(1)}MB` +
      (prepared.scaleCorrection === 1
        ? ""
        : ` (scale corrected x${prepared.scaleCorrection.toFixed(3)})`)
  );

  return saveUpload(
    ["models", "dishes", "glb", `${slug}-${Date.now()}.glb`],
    prepared.buffer
  );
}

export async function startArGeneration(dishId: string, imageDataUri: string) {
  const taskId = await createModelingTask(imageDataUri);
  await prisma.dish.update({
    where: { id: dishId },
    data: {
      arGenerationTaskId: taskId,
      arGenerationPhase: "MODELING",
      arGenerationStatus: "PENDING",
    },
  });
}

async function fail(dishId: string, error: string): Promise<ArGenerationState> {
  await prisma.dish.update({
    where: { id: dishId },
    data: {
      arGenerationStatus: "FAILED",
      arGenerationTaskId: null,
      arGenerationPhase: null,
    },
  });
  return { status: "FAILED", error };
}

/**
 * Polls the task the dish is currently waiting on and moves it one step
 * forward. Safe to call repeatedly; it only writes to the database when
 * something actually changed.
 */
async function advance(dishId: string): Promise<ArGenerationState> {
  const dish = await prisma.dish.findUnique({
    where: { id: dishId },
    include: { category: true },
  });
  if (!dish) throw new Error("Dish not found");

  if (!dish.arGenerationTaskId) {
    return dish.arGenerationStatus === "FAILED"
      ? { status: "FAILED", error: "The last generation failed." }
      : { status: "IDLE" };
  }

  // Rows written before the two-phase pipeline existed only ever held a
  // modeling task.
  const phase: MeshyPhase = dish.arGenerationPhase ?? "MODELING";
  const task = await getTask(phase, dish.arGenerationTaskId);

  if (task.status === "FAILED" || task.status === "CANCELED") {
    return fail(dishId, task.task_error?.message || "Generation failed");
  }

  if (task.status !== "SUCCEEDED") {
    if (task.status !== dish.arGenerationStatus) {
      await prisma.dish.update({
        where: { id: dishId },
        data: { arGenerationStatus: task.status },
      });
    }
    return { status: task.status, progress: overallProgress(phase, task.progress) };
  }

  // Modeling finished: hand the mesh to the sizing task rather than shipping
  // it at whatever size the reconstruction produced.
  if (phase === "MODELING") {
    const sizingTaskId = await createSizingTask(
      dish.arGenerationTaskId,
      dishSizeForCategory(dish.category.slug)
    );
    await prisma.dish.update({
      where: { id: dishId },
      data: {
        arGenerationTaskId: sizingTaskId,
        arGenerationPhase: "SIZING",
        arGenerationStatus: "IN_PROGRESS",
      },
    });
    return { status: "IN_PROGRESS", progress: overallProgress("SIZING", 0) };
  }

  const glbRemoteUrl = task.model_urls?.glb;
  if (!glbRemoteUrl) return fail(dishId, "Meshy did not return a .glb model");

  const previousGlbUrl = dish.arModelGlbUrl;
  const glbUrl = await storeGlb(
    glbRemoteUrl,
    dish.slug,
    dishSizeForCategory(dish.category.slug)
  );

  await prisma.dish.update({
    where: { id: dishId },
    data: {
      arModelGlbUrl: glbUrl,
      arGenerationStatus: null,
      arGenerationTaskId: null,
      arGenerationPhase: null,
    },
  });
  await deleteUpload(previousGlbUrl);

  return { status: "SUCCEEDED" };
}

/**
 * Coalesces concurrent polls for the same dish onto one run.
 *
 * Two admin tabs polling in step would each see the modeling task finish and
 * each start a sizing task — two charges, and the second overwrites the
 * first's bookkeeping. Sharing the in-flight promise makes the extra callers
 * observers of the same step. This is per-process, which is exactly the
 * deployment here (one Node server, one Postgres container); a multi-instance
 * deployment would need the claim in the database instead.
 */
const inFlight = new Map<string, Promise<ArGenerationState>>();

export function advanceArGeneration(dishId: string): Promise<ArGenerationState> {
  const running = inFlight.get(dishId);
  if (running) return running;

  const run = advance(dishId).finally(() => inFlight.delete(dishId));
  inFlight.set(dishId, run);
  return run;
}
