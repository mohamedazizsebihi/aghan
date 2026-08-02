const MESHY_API_BASE = "https://api.meshy.ai/openapi/v1";

/**
 * A dish model is produced in two Meshy tasks, in order:
 *
 *   MODELING — image-to-3d turns the photo into a textured mesh, at whatever
 *              arbitrary size the reconstruction happens to land on.
 *   SIZING   — resize scales that mesh to the real-world size we decided on
 *              in ar-scale.ts, and seats its origin on the table surface.
 *
 * They are separate endpoints with identical task/status shapes, so the two
 * phases share one polling path — only the URL differs.
 */
export const MESHY_TASK_PATH = {
  MODELING: "image-to-3d",
  SIZING: "resize",
} as const;

export type MeshyPhase = keyof typeof MESHY_TASK_PATH;

export const meshyEnabled = Boolean(process.env.MESHY_API_KEY);

export type MeshyTaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELED";

export type MeshyTask = {
  id: string;
  status: MeshyTaskStatus;
  progress: number;
  model_urls?: { glb?: string; [key: string]: string | undefined };
  task_error?: { message?: string };
};

async function meshyFetch(path: string, init?: RequestInit) {
  const key = process.env.MESHY_API_KEY;
  if (!key) throw new Error("MESHY_API_KEY is not set");

  const res = await fetch(`${MESHY_API_BASE}/${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${key}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message || `Meshy request failed (${res.status})`);
  }
  return body;
}

export async function createModelingTask(imageDataUri: string): Promise<string> {
  const body = await meshyFetch(MESHY_TASK_PATH.MODELING, {
    method: "POST",
    body: JSON.stringify({
      image_url: imageDataUri,
      // Pinned rather than left to "latest": 4k textures are rejected by
      // meshy-5, so an unpinned default silently downgrading the model would
      // cost quality without any error to notice.
      ai_model: "meshy-6",
      should_texture: true,
      // What makes a plate of food read as real is the surface — the sheen on
      // an aubergine, the matte of rice, the grain of bread. That is exactly
      // what the PBR maps carry, and 4K is where they stop looking soft at
      // arm's length. The resulting file is far too big to serve as-is; it is
      // re-encoded for delivery in lib/glb.ts, which is what makes this
      // affordable.
      enable_pbr: true,
      texture_resolution: "4k",
      should_remesh: true,
      // Enough silhouette detail for the loose, uneven shapes of plated food
      // without paying for geometry no phone screen resolves.
      target_polycount: 50000,
      // GLB only. iOS no longer gets a Meshy-built USDZ — model-viewer
      // generates one on the fly from this file, so the corrected scale
      // applies on both platforms and there is a single file to get right.
      // See ARViewer for the other half of that decision.
      target_formats: ["glb"],
      // Sizing is deliberately NOT done here: auto_size guesses real-world
      // dimensions from the photo and gets them wrong. The SIZING task below
      // sets them from ar-scale.ts instead.
    }),
  });
  return body.result as string;
}

/**
 * Scales a finished modeling task's mesh so its longest side matches the
 * real-world size of the dish, and moves the origin to the bottom of the
 * bounding box so it sits flush on the detected table rather than floating
 * half-buried in it.
 */
export async function createSizingTask(
  modelingTaskId: string,
  longestSideMeters: number
): Promise<string> {
  const body = await meshyFetch(MESHY_TASK_PATH.SIZING, {
    method: "POST",
    body: JSON.stringify({
      input_task_id: modelingTaskId,
      resize_longest_side: longestSideMeters,
      origin_at: "bottom",
    }),
  });
  return body.result as string;
}

export async function getTask(
  phase: MeshyPhase,
  taskId: string
): Promise<MeshyTask> {
  return meshyFetch(`${MESHY_TASK_PATH[phase]}/${taskId}`);
}
