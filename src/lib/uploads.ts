import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getR2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";

/**
 * Runtime-uploaded content (dish photos, category photos, AR models) lives in
 * Cloudflare R2, not on the container's disk.
 *
 * It used to be written under `uploads/` and served by a route handler that
 * read the file back on every request (see the comment history in
 * /api/uploads/[...path]/route.ts) — necessary because Next's production
 * server only serves `public/` as it stood at build time, and because a
 * single container's disk doesn't survive a redeploy or scale past one
 * instance. R2 removes both problems: it's addressed by its own public URL, so
 * nothing in this app needs to serve the bytes at all.
 */
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  glb: "model/gltf-binary",
  usdz: "model/vnd.usdz+zip",
};

export function contentTypeFor(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/** Every filename this app generates includes Date.now(), so a key is never reused. */
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";

export async function saveUpload(subpath: string[], buffer: Buffer) {
  const key = subpath.join("/");
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentTypeFor(key),
      CacheControl: IMMUTABLE_CACHE,
    })
  );
  return `${R2_PUBLIC_URL}/${key}`;
}

const UPLOAD_URL_PREFIX = "/api/uploads/";

/**
 * Splits a stored URL into where it points: an R2 key (current uploads), a
 * legacy local key (uploads made before the R2 migration, not yet moved), or
 * neither (a seeded `/images/...` asset in `public/`, which isn't an upload at
 * all — every caller here treats that as "nothing to do").
 */
function locate(
  url: string
): { kind: "r2"; key: string } | { kind: "local"; subpath: string[] } | null {
  if (R2_PUBLIC_URL && url.startsWith(`${R2_PUBLIC_URL}/`)) {
    return { kind: "r2", key: url.slice(R2_PUBLIC_URL.length + 1) };
  }
  if (url.startsWith(UPLOAD_URL_PREFIX)) {
    return { kind: "local", subpath: url.slice(UPLOAD_URL_PREFIX.length).split("/") };
  }
  return null;
}

/**
 * Resolves a legacy local upload path to a real file inside UPLOADS_DIR, or
 * throws. The trailing separator matters: without it a sibling directory such
 * as `uploads-backup/` would pass the prefix check.
 */
export function resolveUploadPath(subpath: string[]) {
  const resolved = path.resolve(UPLOADS_DIR, ...subpath);
  if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
    throw new Error("Invalid path");
  }
  return resolved;
}

/**
 * Reads back the bytes behind a stored URL, from R2 or (for rows not yet
 * migrated) the local disk. Used to hand a dish's current photo to Meshy for
 * AR generation.
 */
export async function readUploadFromUrl(url: string): Promise<Buffer> {
  const location = locate(url);
  if (!location) throw new Error(`Not an upload URL: ${url}`);

  if (location.kind === "local") {
    return readFile(resolveUploadPath(location.subpath));
  }

  const result = await getR2Client().send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: location.key })
  );
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Empty response reading ${location.key} from R2`);
  return Buffer.from(bytes);
}

/**
 * Best-effort cleanup for a URL previously returned by saveUpload(). Silently
 * ignores URLs that aren't an upload at all (e.g. seeded /images/... assets)
 * and objects/files that are already gone, since a failed delete shouldn't
 * block the replacement that triggered it.
 */
export async function deleteUpload(url: string | null | undefined) {
  if (!url) return;
  const location = locate(url);
  if (!location) return;

  if (location.kind === "local") {
    try {
      await unlink(resolveUploadPath(location.subpath));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`Failed to delete orphaned local upload at ${url}:`, error);
      }
    }
    return;
  }

  try {
    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: location.key })
    );
  } catch (error) {
    console.error(`Failed to delete orphaned R2 object ${location.key}:`, error);
  }
}

/** Every object under a key prefix — for the orphan sweep in scripts/fix-ar-models.ts. */
export async function listUploadKeys(prefix: string) {
  const objects: { key: string; bytes: number }[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await getR2Client().send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of page.Contents ?? []) {
      if (obj.Key) objects.push({ key: obj.Key, bytes: obj.Size ?? 0 });
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

export async function deleteUploadKey(key: string) {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
