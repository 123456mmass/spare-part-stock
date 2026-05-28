import { prisma } from "./prisma";

export interface BuildingInfo {
  id: string;
  name: string;
  sortOrder: number;
  partCount: number;
  totalQuantity: number;
}

export async function listBuildings(): Promise<BuildingInfo[]> {
  const buildings = await prisma.building.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const counts = await prisma.part.groupBy({
    by: ["buildingId"],
    where: { isActive: true, buildingId: { not: null } },
    _count: true,
    _sum: { quantity: true },
  });

  const countMap = new Map(
    counts.map((c) => [
      c.buildingId!,
      { partCount: c._count, totalQuantity: c._sum.quantity ?? 0 },
    ])
  );

  return buildings.map((b) => ({
    id: b.id,
    name: b.name,
    sortOrder: b.sortOrder,
    partCount: countMap.get(b.id)?.partCount ?? 0,
    totalQuantity: countMap.get(b.id)?.totalQuantity ?? 0,
  }));
}

export async function resolveBuildingIdByName(
  name: string | undefined | null
): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const buildings = await prisma.building.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const match = buildings.find(
    (b) => b.name.toLowerCase() === trimmed.toLowerCase()
  );
  return match?.id ?? null;
}

export async function upsertBuildingByName(name: string): Promise<string> {
  const trimmed = name.trim();
  const existing = await prisma.building.findFirst({
    where: { name: { equals: trimmed } },
  });
  if (existing) return existing.id;

  const created = await prisma.building.create({
    data: { name: trimmed },
  });
  return created.id;
}
