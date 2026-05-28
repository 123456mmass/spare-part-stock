/**
 * Production one-shot: ensure Building table + seed ท.003 + backfill from location.
 * Usage on VPS: npx tsx scripts/prod-migrate-buildings.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const dbUrl = process.env.DATABASE_URL?.replace(/^file:/, "") || "dev.db";
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

const DEFAULT_BUILDINGS = (process.env.BUILDING_SEED_NAMES || "ท.003")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  console.log("Building migration starting...");
  console.log("DB:", dbUrl);
  console.log("Seed buildings:", DEFAULT_BUILDINGS.join(", "));

  for (let i = 0; i < DEFAULT_BUILDINGS.length; i++) {
    const name = DEFAULT_BUILDINGS[i];
    await prisma.building.upsert({
      where: { name },
      update: { sortOrder: i, isActive: true },
      create: { name, sortOrder: i },
    });
    console.log(`  upserted building: ${name}`);
  }

  const buildings = await prisma.building.findMany({ where: { isActive: true } });
  let totalLinked = 0;

  for (const building of buildings) {
    const byExactLocation = await prisma.part.updateMany({
      where: {
        isActive: true,
        buildingId: null,
        location: building.name,
      },
      data: { buildingId: building.id },
    });

    const parts = await prisma.part.findMany({
      where: { isActive: true, buildingId: null, location: { not: null } },
      select: { id: true, location: true },
    });

    let fuzzy = 0;
    for (const part of parts) {
      const loc = part.location?.trim();
      if (!loc) continue;
      if (loc.toLowerCase() === building.name.toLowerCase()) {
        await prisma.part.update({
          where: { id: part.id },
          data: { buildingId: building.id },
        });
        fuzzy++;
      }
    }

    const linked = byExactLocation.count + fuzzy;
    totalLinked += linked;
    console.log(`  ${building.name}: linked ${linked} parts from location`);
  }

  const unassigned = await prisma.part.count({
    where: { isActive: true, buildingId: null },
  });

  // Single-building sites: assign remaining parts to the only building
  if (unassigned > 0 && buildings.length === 1) {
    const assigned = await prisma.part.updateMany({
      where: { isActive: true, buildingId: null },
      data: { buildingId: buildings[0].id },
    });
    console.log(`  assigned ${assigned.count} parts to sole building ${buildings[0].name}`);
  }

  const remaining = await prisma.part.count({
    where: { isActive: true, buildingId: null },
  });
  const total = await prisma.part.count({ where: { isActive: true } });

  console.log("\n=== Done ===");
  console.log(`Total active parts: ${total}`);
  console.log(`Linked to building: ${total - remaining}`);
  console.log(`Still unassigned: ${remaining}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
