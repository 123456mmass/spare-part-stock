import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { embedImage, float32ToBytes } from "./embeddings";

const MAX_SIZE = 10 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "parts");

export interface SavedPartImage {
  url: string;
  embedding: Uint8Array<ArrayBuffer> | null;
}

export async function savePartImage(
  buffer: Buffer,
  originalName: string,
  partId: string
): Promise<SavedPartImage> {
  if (buffer.length > MAX_SIZE) {
    throw new Error("File must be 10MB or smaller");
  }

  const filename = `${partId}-${crypto.randomBytes(4).toString("hex")}.webp`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await sharp(buffer)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(UPLOAD_DIR, filename));

  let embedding: Uint8Array<ArrayBuffer> | null = null;
  try {
    const vec = await embedImage(buffer);
    embedding = float32ToBytes(vec);
  } catch (err) {
    console.error("embedImage failed, saving image without embedding:", (err as Error).message);
  }

  return { url: `/uploads/parts/${filename}`, embedding };
}
