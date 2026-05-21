import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB (HEIC can be large)
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "parts");

export async function savePartImage(
  buffer: Buffer,
  originalName: string,
  partId: string
): Promise<string> {
  if (buffer.length > MAX_SIZE) {
    throw new Error("File must be 10MB or smaller");
  }

  const filename = `${partId}-${crypto.randomBytes(4).toString("hex")}.webp`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await sharp(buffer)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(UPLOAD_DIR, filename));

  return `/uploads/parts/${filename}`;
}
