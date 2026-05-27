import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { embedImage, float32ToBytes } from "../src/lib/embeddings";

async function embedWithRetry(buf: Buffer, attempts = 3): Promise<Uint8Array> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const vec = await embedImage(buf);
      return float32ToBytes(vec);
    } catch (err) {
      lastErr = err;
      console.warn(`  attempt ${i + 1}/${attempts} failed: ${(err as Error).message}`);
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}

async function main() {
  const parts = await prisma.part.findMany({
    where: { imageEmbedding: null, imageUrl: { not: null } },
    select: { id: true, partNumber: true, imageUrl: true },
  });

  console.log(`Found ${parts.length} parts to backfill`);
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const filePath = path.join(process.cwd(), "public", p.imageUrl!);
    try {
      const buf = await fs.readFile(filePath);
      const embedding = await embedWithRetry(buf);
      const ab = new ArrayBuffer(embedding.byteLength);
      new Uint8Array(ab).set(embedding);
      await prisma.part.update({
        where: { id: p.id },
        data: { imageEmbedding: new Uint8Array(ab) },
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
