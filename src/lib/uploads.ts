import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "parts");

export async function savePartImage(
  buffer: Buffer,
  originalName: string,
  partId: string
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error("File must be JPG, PNG, or WebP");
  }

  if (buffer.length > MAX_SIZE) {
    throw new Error("File must be 5MB or smaller");
  }

  const filename = `${partId}-${crypto.randomBytes(4).toString("hex")}.webp`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await sharp(buffer)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(UPLOAD_DIR, filename));

  return `/uploads/parts/${filename}`;
}
