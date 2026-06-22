import sharp from "sharp";

/**
 * Central image normalization pipeline.
 *
 * Why this exists: the prebuilt `sharp` on the server ships libheif WITHOUT the
 * HEVC decoder (libde265), so it can read HEIC *metadata* but cannot decode the
 * pixels — iPhone .heic uploads fail with "bad seek" / "compression format has
 * not been built in". This module detects HEIC by magic bytes and falls back to
 * the WASM `heic-decode` decoder, then feeds the RGBA pixels back into sharp so
 * the rest of the resize/format pipeline is identical for every input format.
 */

export type ImageOutFormat = "jpeg" | "png" | "webp" | "raw";

export interface NormalizeImageOptions {
  format: ImageOutFormat;
  /** Resize the longest side to fit inside, without enlarging. */
  maxDimension?: number;
  /** Resize to exactly cover the given box (like CLIP 336x336). */
  cover?: { width: number; height: number };
  /** JPEG/WebP quality (ignored for png/raw). */
  quality?: number;
  /** Force 4 channels. Automatically applied for raw output. */
  ensureAlpha?: boolean;
}

export interface NormalizedImage {
  buffer: Buffer;
  mime: string;
  width: number;
  height: number;
}

const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
  "avic",
  "hejs",
]);

const AVIF_BRANDS = new Set(["avif", "avis", "avio"]);

/** Detect an image format from magic bytes. Never throws. */
export function detectImageFormat(buffer: Buffer): string {
  if (!buffer || buffer.length === 0) return "ไฟล์ว่าง";
  if (buffer.length < 12) return "ไฟล์เล็กเกินไป";
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "JPEG";
  // PNG
  if (buffer[0] === 0x89 && buffer.slice(1, 4).toString("ascii") === "PNG") return "PNG";
  // GIF
  if (buffer.slice(0, 3).toString("ascii") === "GIF") return "GIF";
  // WebP (RIFF....WEBP)
  if (buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") return "WebP";
  // BMP
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return "BMP";
  // TIFF (II*\0 or MM\0*)
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x2a)
  ) {
    return "TIFF";
  }
  // ISO BMFF container (HEIC/HEIF/AVIF): bytes 4..7 = "ftyp", brand at 8..11
  if (buffer.slice(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.slice(8, 12).toString("ascii").toLowerCase();
    if (HEIC_BRANDS.has(brand)) return "HEIC/HEIF";
    if (AVIF_BRANDS.has(brand)) return "AVIF";
    return "HEIF/AVIF";
  }
  return "ไม่รู้จัก";
}

/** True when the buffer is an HEIC/HEIF container that sharp cannot decode natively. */
export function isHeicFormat(format: string): boolean {
  return format === "HEIC/HEIF";
}

export class UnsupportedImageError extends Error {
  constructor(
    public readonly detectedFormat: string,
    message?: string,
  ) {
    super(
      message ??
        `รองรับไฟล์รูป JPEG/PNG/WebP/GIF/HEIC/AVIF เท่านั้น (ตรวจพบ: ${detectedFormat})`,
    );
    this.name = "UnsupportedImageError";
  }
}

/**
 * Build a sharp pipeline that can decode ANY supported input, including HEIC
 * (via the WASM fallback). Returns a sharp instance ready to chain resize/format.
 */
async function decodeToSharp(buffer: Buffer): Promise<sharp.Sharp> {
  const format = detectImageFormat(buffer);
  if (format === "ไฟล์ว่าง" || format === "ไฟล์เล็กเกินไป" || format === "ไม่รู้จัก") {
    throw new UnsupportedImageError(format);
  }
  if (isHeicFormat(format)) {
    // sharp on this server lacks the HEVC decoder — decode pixels via WASM,
    // then hand the RGBA back to sharp for the resize/format pipeline.
    const heicDecode = (await import("heic-decode")).default;
    const decoded = await heicDecode({ buffer });
    return sharp(Buffer.from(decoded.data), {
      raw: { width: decoded.width, height: decoded.height, channels: 4 },
    });
  }
  // Every other format (incl. AVIF, which sharp DOES decode here) + lenient
  // truncated-file handling so a slightly truncated upload still loads.
  return sharp(buffer, { failOn: "none" });
}

/**
 * Decode + resize + convert any supported image to the requested format.
 * Throws {@link UnsupportedImageError} for unrecognized/corrupt inputs.
 */
export async function normalizeImage(
  buffer: Buffer,
  opts: NormalizeImageOptions,
): Promise<NormalizedImage> {
  let pipeline: sharp.Sharp;
  try {
    pipeline = await decodeToSharp(buffer);
  } catch (err) {
    if (err instanceof UnsupportedImageError) throw err;
    throw new UnsupportedImageError(
      detectImageFormat(buffer),
      `ประมวลผลรูปไม่สำเร็จ: ${(err as Error).message}`,
    );
  }

  if (opts.cover) {
    pipeline = pipeline.resize(opts.cover.width, opts.cover.height, { fit: "cover" });
  } else if (opts.maxDimension) {
    pipeline = pipeline.resize(opts.maxDimension, opts.maxDimension, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  if (opts.ensureAlpha || opts.format === "raw") {
    pipeline = pipeline.ensureAlpha();
  }

  let mime: string;
  switch (opts.format) {
    case "jpeg":
      pipeline = pipeline.jpeg({ quality: opts.quality ?? 80 });
      mime = "image/jpeg";
      break;
    case "png":
      pipeline = pipeline.png();
      mime = "image/png";
      break;
    case "webp":
      pipeline = pipeline.webp({ quality: opts.quality ?? 80 });
      mime = "image/webp";
      break;
    case "raw":
      pipeline = pipeline.raw();
      mime = "application/octet-stream";
      break;
  }

  const result = await pipeline.toBuffer({ resolveWithObject: true });
  return {
    buffer: result.data,
    mime,
    width: result.info.width,
    height: result.info.height,
  };
}
