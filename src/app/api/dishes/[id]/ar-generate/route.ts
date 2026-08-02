import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { meshyEnabled } from "@/lib/meshy";
import { readUploadFromUrl } from "@/lib/uploads";
import { startArGeneration, advanceArGeneration } from "@/lib/ar-generation";

type Params = { params: Promise<{ id: string }> };

const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

const PUBLIC_DIR = path.join(process.cwd(), "public");

async function readDishImage(imageUrl: string): Promise<Buffer> {
  // Admin-uploaded photos live in R2 (or, for rows not yet migrated, the local
  // uploads dir) — readUploadFromUrl knows which from the URL's shape. Anything
  // else is a seeded photo in public/.
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://") || imageUrl.startsWith("/api/uploads/")) {
    return readUploadFromUrl(imageUrl);
  }
  // Resolve before reading so a crafted imageUrl cannot walk out of public/.
  const resolved = path.resolve(PUBLIC_DIR, `.${imageUrl}`);
  if (!resolved.startsWith(PUBLIC_DIR)) throw new Error("Invalid image path");
  return readFile(resolved);
}

async function resolveSourceImage(
  request: NextRequest,
  dish: { imageUrl: string | null }
): Promise<{ dataUri: string } | { error: string }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (file instanceof File) {
      if (!Object.values(IMAGE_MIME).includes(file.type)) {
        return { error: "Photo must be a JPEG or PNG image." };
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      return { dataUri: `data:${file.type};base64,${buffer.toString("base64")}` };
    }
  }

  if (!dish.imageUrl) {
    return { error: "This dish needs a photo before generating a 3D model." };
  }
  const extension = dish.imageUrl.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = IMAGE_MIME[extension] ?? "image/jpeg";
  const fileBuffer = await readDishImage(dish.imageUrl);
  return { dataUri: `data:${mime};base64,${fileBuffer.toString("base64")}` };
}

function errorResponse(error: unknown, fallback: string, status = 500) {
  console.error(error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status }
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!meshyEnabled) {
    return NextResponse.json(
      { error: "AI generation is not configured (missing MESHY_API_KEY)." },
      { status: 503 }
    );
  }

  const { id } = await params;
  const dish = await prisma.dish.findUnique({ where: { id } });
  if (!dish) return NextResponse.json({ error: "Dish not found" }, { status: 404 });

  // Every task costs Meshy credits, so a double-tap (or a second admin on the
  // dish) must not start a parallel run — the caller just joins the one in
  // flight by polling.
  if (dish.arGenerationTaskId) {
    return NextResponse.json({ status: "IN_PROGRESS", progress: 0 });
  }

  try {
    const source = await resolveSourceImage(request, dish);
    if ("error" in source) {
      return NextResponse.json({ error: source.error }, { status: 400 });
    }
    await startArGeneration(id, source.dataUri);
    return NextResponse.json({ status: "PENDING", progress: 0 });
  } catch (error) {
    return errorResponse(error, "Could not start generation");
  }
}

/**
 * Polling endpoint. Advances the generation one step per call (see
 * ar-generation.ts) — convergent, so repeated or concurrent calls are safe,
 * but never cacheable.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const state = await advanceArGeneration(id);
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Could not check status");
  }
}
