import sharp from "sharp";

/**
 * Minimal GLB toolkit: measure a model's real-world size, force it to a size
 * we chose, and re-encode its textures for delivery.
 *
 * Why hand-rolled rather than a glTF library: the only operations needed are
 * a bounding-box walk, one root transform, and an image pass — and the two
 * things that would normally justify the dependency (Draco geometry
 * compression and KTX2 textures) are both unusable here. Scene Viewer does
 * not support KHR_texture_basisu, and model-viewer's on-the-fly USDZ export
 * cannot read pixels back out of a compressed texture, so a KTX2 model would
 * render untextured in AR on both platforms. Plain JPEG is what actually
 * survives the trip to Scene Viewer and Quick Look.
 */

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"

/**
 * Base colour is the map the eye actually reads on a plate of food, so it
 * keeps its full 4K. Normal, metallic-roughness, occlusion and emission carry
 * far less perceptible detail at arm's length; halving them costs nothing
 * visible and takes roughly three quarters off their weight, which is what
 * keeps a full PBR model inside a size a phone will actually download.
 * Meshy can also emit 8K — no phone benefits from it.
 */
const MAX_COLOR_TEXTURE_SIZE = 4096;
const MAX_DATA_TEXTURE_SIZE = 2048;

/** Anything closer than this to the target is left alone. */
const SCALE_TOLERANCE = 0.02;

type GltfNode = {
  mesh?: number;
  children?: number[];
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  name?: string;
};

type GltfJson = {
  scene?: number;
  scenes: { nodes: number[] }[];
  nodes: GltfNode[];
  meshes: { primitives: { attributes: Record<string, number> }[] }[];
  accessors: { min?: number[]; max?: number[] }[];
  bufferViews: {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
    target?: number;
  }[];
  buffers: { byteLength: number; uri?: string }[];
  images?: { bufferView?: number; mimeType?: string; uri?: string }[];
  textures?: { source?: number }[];
  materials?: {
    pbrMetallicRoughness?: { baseColorTexture?: { index: number } };
    emissiveTexture?: { index: number };
  }[];
};

export type Vec3 = [number, number, number];

export type GlbBounds = { min: Vec3; max: Vec3; size: Vec3; longestSide: number };

function align4(n: number) {
  return (n + 3) & ~3;
}

export function parseGlb(buffer: Buffer): { json: GltfJson; bin: Buffer } {
  if (buffer.length < 12 || buffer.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error("Not a GLB file");
  }

  let json: GltfJson | null = null;
  // Views into the source buffer, so this stays a parse rather than a copy.
  let bin: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === CHUNK_JSON) json = JSON.parse(chunk.toString("utf8"));
    else if (type === CHUNK_BIN) bin = chunk;
    offset += 8 + length;
  }

  if (!json) throw new Error("GLB has no JSON chunk");
  return { json, bin };
}

export function buildGlb(json: GltfJson, bin: Buffer): Buffer {
  const jsonChunk = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPadded = Buffer.concat([
    jsonChunk,
    Buffer.alloc(align4(jsonChunk.length) - jsonChunk.length, 0x20), // spaces
  ]);
  const binPadded = Buffer.concat([
    bin,
    Buffer.alloc(align4(bin.length) - bin.length, 0),
  ]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binPadded.length, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonHeader.writeUInt32LE(CHUNK_JSON, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binPadded.length, 0);
  binHeader.writeUInt32LE(CHUNK_BIN, 4);

  return Buffer.concat([header, jsonHeader, jsonPadded, binHeader, binPadded]);
}

// --- transforms -----------------------------------------------------------

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a: number[], b: number[]) {
  const out = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) out[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
    }
  }
  return out;
}

function localMatrix(node: GltfNode) {
  if (node.matrix) return node.matrix;
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function transformPoint(m: number[], p: Vec3): Vec3 {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

/**
 * World-space bounding box of the default scene, in metres (glTF's unit).
 * Uses each accessor's declared min/max, so it costs nothing to run — no
 * vertex data is decoded.
 */
export function measureBounds(json: GltfJson): GlbBounds {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];

  const visit = (nodeIndex: number, parent: number[]) => {
    const node = json.nodes[nodeIndex];
    if (!node) return;
    const world = multiply(parent, localMatrix(node));

    if (node.mesh !== undefined) {
      for (const primitive of json.meshes[node.mesh].primitives) {
        const accessor = json.accessors[primitive.attributes.POSITION];
        if (!accessor?.min || !accessor?.max) continue;
        // Every corner of the local box, since a rotation can make any of
        // them the extreme one in world space.
        for (let corner = 0; corner < 8; corner++) {
          const local: Vec3 = [
            corner & 1 ? accessor.max[0] : accessor.min[0],
            corner & 2 ? accessor.max[1] : accessor.min[1],
            corner & 4 ? accessor.max[2] : accessor.min[2],
          ];
          const world_ = transformPoint(world, local);
          for (let axis = 0; axis < 3; axis++) {
            min[axis] = Math.min(min[axis], world_[axis]);
            max[axis] = Math.max(max[axis], world_[axis]);
          }
        }
      }
    }
    node.children?.forEach((child) => visit(child, world));
  };

  const scene = json.scenes[json.scene ?? 0];
  scene.nodes.forEach((nodeIndex) => visit(nodeIndex, IDENTITY));

  const size: Vec3 = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return { min, max, size, longestSide: Math.max(...size) };
}

/**
 * Scales the whole scene by wrapping its roots in a new parent node, rather
 * than rewriting every transform — safe regardless of how the exporter
 * structured the hierarchy.
 */
function applyUniformScale(json: GltfJson, factor: number) {
  const scene = json.scenes[json.scene ?? 0];
  json.nodes.push({
    name: "ar-real-world-scale",
    scale: [factor, factor, factor],
    children: [...scene.nodes],
  });
  scene.nodes = [json.nodes.length - 1];
}

// --- textures -------------------------------------------------------------

/**
 * Image indices used as base colour or emission — the ones a viewer sees as
 * colour rather than as surface data.
 */
function colorImageIndices(json: GltfJson): Set<number> {
  const indices = new Set<number>();
  const add = (textureIndex?: number) => {
    if (textureIndex === undefined) return;
    const source = json.textures?.[textureIndex]?.source;
    if (source !== undefined) indices.add(source);
  };
  for (const material of json.materials ?? []) {
    add(material.pbrMetallicRoughness?.baseColorTexture?.index);
    add(material.emissiveTexture?.index);
  }
  return indices;
}

async function reencode(
  image: Buffer,
  maxSize: number
): Promise<{ data: Buffer; mimeType: string }> {
  // Bounded rather than disabled. These textures are fetched from Meshy over the
  // network and decoded in the same process that serves orders, so a malformed
  // or hostile image that decompresses to billions of pixels would take the
  // restaurant down with it. 16k x 16k is far above any real PBR texture.
  const pipeline = sharp(image, { limitInputPixels: 16_384 * 16_384 });
  const { width = 0, height = 0, hasAlpha } = await pipeline.metadata();

  if (width > maxSize || height > maxSize) {
    pipeline.resize(maxSize, maxSize, { fit: "inside" });
  }

  // JPEG has no alpha channel, so a texture that uses one has to stay PNG —
  // silently flattening it would turn cut-outs into black.
  if (hasAlpha) {
    return {
      data: await pipeline.png({ compressionLevel: 9, effort: 10 }).toBuffer(),
      mimeType: "image/png",
    };
  }
  return {
    data: await pipeline
      // 4:4:4 keeps full colour resolution: the usual 4:2:0 subsampling
      // smears the fine colour detail that makes food look real, which is
      // the entire reason for generating 4K textures.
      .jpeg({ quality: 90, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toBuffer(),
    mimeType: "image/jpeg",
  };
}

/**
 * Re-encodes every embedded texture and rebuilds the binary chunk around the
 * new sizes. Meshy emits 4K PBR maps as PNG, which is lossless and enormous;
 * a 4K plate of food is visually identical at JPEG q90 and a fraction of the
 * bytes, which is the difference between an AR model that loads on a phone
 * and one that times out.
 */
async function reencodeTextures(json: GltfJson, bin: Buffer) {
  if (!json.images?.length) return bin;

  const colorImages = colorImageIndices(json);
  // If no material declares a base colour map, the role of each image is
  // unknown — treat them all as colour rather than silently downscaling the
  // one texture the model has.
  const downscaleDataMaps = colorImages.size > 0;
  const replacements = new Map<number, Buffer>();

  for (const [imageIndex, image] of json.images.entries()) {
    if (image.bufferView === undefined) continue; // URI-based, not embedded
    const view = json.bufferViews[image.bufferView];
    const start = view.byteOffset ?? 0;
    const source = bin.subarray(start, start + view.byteLength);
    const maxSize =
      downscaleDataMaps && !colorImages.has(imageIndex)
        ? MAX_DATA_TEXTURE_SIZE
        : MAX_COLOR_TEXTURE_SIZE;
    try {
      const { data, mimeType } = await reencode(source, maxSize);
      // Never accept a "compression" that made things worse.
      if (data.length < source.length) {
        replacements.set(image.bufferView, data);
        image.mimeType = mimeType;
      }
    } catch (error) {
      console.warn("Skipped a texture that could not be re-encoded:", error);
    }
  }

  if (!replacements.size) return bin;

  // Rebuild the binary chunk in bufferView order. Indices are preserved, so
  // accessors and images keep pointing at the right data.
  const parts: Buffer[] = [];
  let offset = 0;
  for (const [index, view] of json.bufferViews.entries()) {
    const replacement = replacements.get(index);
    const data =
      replacement ??
      bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);

    const padding = align4(offset) - offset;
    if (padding) parts.push(Buffer.alloc(padding, 0));
    offset += padding;

    view.byteOffset = offset;
    view.byteLength = data.length;
    parts.push(data);
    offset += data.length;
  }

  const rebuilt = Buffer.concat(parts);
  json.buffers[0].byteLength = rebuilt.length;
  return rebuilt;
}

// --- entry point ----------------------------------------------------------

export type GlbPreparation = {
  buffer: Buffer;
  bytesBefore: number;
  bytesAfter: number;
  /** Size in metres after preparation. */
  dimensions: Vec3;
  /** Correction applied on top of what the generator produced, 1 = none. */
  scaleCorrection: number;
};

/**
 * Makes a freshly generated model fit to serve: verifiably the right
 * real-world size, and small enough to load over a phone connection.
 */
export async function prepareGlbForAr(
  buffer: Buffer,
  targetLongestSideM: number
): Promise<GlbPreparation> {
  const { json, bin } = parseGlb(buffer);

  const measured = measureBounds(json);
  let scaleCorrection = 1;
  if (measured.longestSide > 0) {
    const factor = targetLongestSideM / measured.longestSide;
    // The generator is asked for the right size, but "asked for" is not
    // "is" — measuring and correcting makes the served file correct by
    // construction instead of by trust.
    if (Math.abs(factor - 1) > SCALE_TOLERANCE) {
      applyUniformScale(json, factor);
      scaleCorrection = factor;
    }
  }

  const rebuiltBin = await reencodeTextures(json, bin);
  const out = buildGlb(json, rebuiltBin);

  return {
    buffer: out,
    bytesBefore: buffer.length,
    bytesAfter: out.length,
    dimensions: measureBounds(json).size,
    scaleCorrection,
  };
}
