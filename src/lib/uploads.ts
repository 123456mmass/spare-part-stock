import { normalizeImage } from "./image-normalize";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { embedImageWithMetadata, float32ToBytes } from "./embeddings";

const MAX_SIZE = 10 * 1024 * 1024;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "parts");

export interface SavedPartImage {
  url: string;
  embedding: Uint8Array<ArrayBuffer> | null;
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddingDimension: number | null;
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
  const { buffer: webpBuf } = await normalizeImage(buffer, {
    format: "webp",
    maxDimension: 800,
    quality: 80,
  });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), webpBuf);

  let embedding: Uint8Array<ArrayBuffer> | null = null;
  let embeddingProvider: string | null = null;
  let embeddingModel: string | null = null;
  let embeddingDimension: number | null = null;
  try {
    const result = await embedImageWithMetadata(buffer, "document");
    embedding = float32ToBytes(result.vector);
    embeddingProvider = result.provider;
    embeddingModel = result.model;
    embeddingDimension = result.dimension;
  } catch (err) {
    console.error("embedImage failed, saving image without embedding:", (err as Error).message);
  }

  return {
    url: `/uploads/parts/${filename}`,
    embedding,
    embeddingProvider,
    embeddingModel,
    embeddingDimension,
  };
}
