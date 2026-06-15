/**
 * Backfill text embeddings for all active parts that don't have one yet.
 *
 * Usage:  npx tsx scripts/backfill-text-embeddings.ts [--batch 50] [--delay 300]
 *
 * Flags:
 *   --batch N   Number of parts to process in one query (default: 50)
 *   --delay N   Milliseconds to wait between each part (default: 300)
 */

import { PrismaClient } from "@prisma/client";
import { regeneratePartTextEmbedding } from "../src/lib/part-text-embedding";

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  let batch = 50;
  let delay = 300;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--batch" && args[i + 1]) {
      batch = Number(args[i + 1]) || 50;
      i++;
    }
    if (args[i] === "--delay" && args[i + 1]) {
      delay = Number(args[i + 1]) || 300;
      i++;
    }
  }

  return { batch, delay };
}

async function main() {
  const { batch, delay } = parseArgs();

  const total = await prisma.part.count({
    where: { isActive: true, textEmbedding: null },
  });

  console.log(`\n🔄 Text Embedding Backfill`);
  console.log(`   Parts without text embedding: ${total}`);
  console.log(`   Batch size: ${batch}, Delay: ${delay}ms\n`);

  if (total === 0) {
    console.log("✅ All parts already have text embeddings. Nothing to do.");
    return;
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  while (processed < total) {
    const parts = await prisma.part.findMany({
      where: { isActive: true, textEmbedding: null },
      select: { id: true, partNumber: true, partName: true },
      take: batch,
      orderBy: { partNumber: "asc" },
    });

    if (parts.length === 0) break;

    for (const part of parts) {
      processed++;
      try {
        await regeneratePartTextEmbedding(part.id);
        succeeded++;
        process.stdout.write(
          `  ✅ [${processed}/${total}] ${part.partNumber} — ${part.partName}\n`,
        );
      } catch (error) {
        failed++;
        const msg = error instanceof Error ? error.message : String(error);
        process.stderr.write(
          `  ❌ [${processed}/${total}] ${part.partNumber} — ${msg}\n`,
        );
      }

      // Throttle to avoid overwhelming the embedding model
      if (delay > 0 && processed < total) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.log(`\n📊 Backfill Complete`);
  console.log(`   Total: ${processed}`);
  console.log(`   ✅ Succeeded: ${succeeded}`);
  console.log(`   ❌ Failed: ${failed}`);

  // Verify remaining count
  const remaining = await prisma.part.count({
    where: { isActive: true, textEmbedding: null },
  });
  console.log(`   Remaining without embedding: ${remaining}\n`);
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
