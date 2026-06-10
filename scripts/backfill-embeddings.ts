import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../src/lib/prisma";
import {
  currentImageEmbeddingMetadata,
  embedImageWithMetadata,
  float32ToBytes,
} from "../src/lib/embeddings";

const DEFAULT_VOYAGE_DELAY_MS = 21_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(error: unknown, attempt: number): number {
  const message = error instanceof Error ? error.message : String(error);
  if (/429|rate limit|reduced rate limits/i.test(message)) {
    return Number(process.env.VOYAGE_BACKFILL_RETRY_MS || 65_000);
  }
  return 1000 * (attempt + 1);
}

async function embedWithRetry(
  buf: Buffer,
  attempts = 3,
): Promise<Awaited<ReturnType<typeof embedImageWithMetadata>>> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return embedImageWithMetadata(buf, "document");
    } catch (err) {
      lastErr = err;
      console.warn(`  attempt ${i + 1}/${attempts} failed: ${(err as Error).message}`);
      if (i < attempts - 1) await sleep(retryDelayMs(err, i));
    }
  }
  throw lastErr;
}

async function main() {
  const current = currentImageEmbeddingMetadata();
  const limit = Number(process.env.BACKFILL_LIMIT || 0);
  const parts = await prisma.part.findMany({
    where: {
      imageUrl: { not: null },
      OR: [
        { imageEmbedding: null },
        { imageEmbeddingProvider: { not: current.provider } },
        { imageEmbeddingModel: { not: current.model } },
      ],
    },
    select: { id: true, partNumber: true, imageUrl: true },
    ...(limit > 0 ? { take: limit } : {}),
  });

  console.log(
    `Found ${parts.length} parts to backfill using ${current.provider}/${current.model}`,
  );
  const delayMs = Number(
    process.env.IMAGE_EMBEDDING_BACKFILL_DELAY_MS ||
      (current.provider === "voyage" ? DEFAULT_VOYAGE_DELAY_MS : 0),
  );
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < parts.length; i++) {
    if (i > 0 && delayMs > 0) await sleep(delayMs);
    const p = parts[i];
    const filePath = path.join(process.cwd(), "public", p.imageUrl!);
    try {
      const buf = await fs.readFile(filePath);
      const result = await embedWithRetry(buf);
      const embedding = float32ToBytes(result.vector);
      const ab = new ArrayBuffer(embedding.byteLength);
      new Uint8Array(ab).set(embedding);
      await prisma.part.update({
        where: { id: p.id },
        data: {
          imageEmbedding: new Uint8Array(ab),
          imageEmbeddingProvider: result.provider,
          imageEmbeddingModel: result.model,
          imageEmbeddingDimension: result.dimension,
        },
      });
      ok++;
      if ((i + 1) % 10 === 0 || i === parts.length - 1) {
        console.log(`  [${i + 1}/${parts.length}] ok=${ok} failed=${failed}`);
      }
    } catch (err) {
      failed++;
      console.error(`  FAIL ${p.partNumber} (${p.imageUrl}): ${(err as Error).message}`);
    }
  }

  console.log(`Done. ok=${ok} failed=${failed}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
