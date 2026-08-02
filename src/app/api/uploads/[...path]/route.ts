import { NextResponse, type NextRequest } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { resolveUploadPath, contentTypeFor } from "@/lib/uploads";

/** Parses a single-range `bytes=start-end` header against a known file size. */
function parseRange(header: string | null, size: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  // "bytes=-500" means the last 500 bytes.
  const start = rawStart === "" ? size - Number(rawEnd) : Number(rawStart);
  const end = rawStart === "" || rawEnd === "" ? size - 1 : Number(rawEnd);

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

function streamFile(filePath: string, range?: { start: number; end: number }) {
  return Readable.toWeb(
    createReadStream(filePath, range)
  ) as ReadableStream<Uint8Array>;
}

/**
 * LEGACY / back-compat only. New uploads go straight to Cloudflare R2 (see
 * src/lib/uploads.ts) and are served from R2's own public URL — this route is
 * never in that path. It stays alive only to keep serving rows written before
 * the R2 migration, whose imageUrl/arModelGlbUrl still point at
 * `/api/uploads/...` on local disk. Once scripts/migrate-uploads-to-r2.ts has
 * been run and every such row is confirmed gone, this route (and the `uploads`
 * volume mount in docker-compose.yml) can be deleted.
 *
 * Streamed rather than buffered, and range-aware: AR models are several MB
 * each and both Quick Look and Scene Viewer fetch them with Range requests —
 * answering those with a 200 and the whole body made every AR launch pull the
 * entire model again from byte zero.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  let filePath: string;
  try {
    filePath = resolveUploadPath(segments);
  } catch {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const stats = await stat(filePath).catch(() => null);
  if (!stats?.isFile()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const etag = `"${stats.size.toString(16)}-${stats.mtimeMs.toString(16)}"`;
  const baseHeaders = {
    "Content-Type": contentTypeFor(segments[segments.length - 1]),
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    ETag: etag,
  };

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: baseHeaders });
  }

  const range = parseRange(request.headers.get("range"), stats.size);
  if (range) {
    return new NextResponse(streamFile(filePath, range), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${range.start}-${range.end}/${stats.size}`,
        "Content-Length": String(range.end - range.start + 1),
      },
    });
  }

  return new NextResponse(streamFile(filePath), {
    headers: { ...baseHeaders, "Content-Length": String(stats.size) },
  });
}
