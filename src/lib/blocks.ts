import { prisma } from "./prisma";

export interface BlockInfo {
  name: string;
  partCount: number;
}

export async function listBlocks(): Promise<BlockInfo[]> {
  const groups = await prisma.part.groupBy({
    by: ["plant"],
    where: { plant: { not: null } },
    _count: true,
  });

  return groups
    .map((g) => ({ name: g.plant!, partCount: g._count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function renameBlock(
  oldName: string,
  newName: string
): Promise<{ updated: number }> {
  const result = await prisma.part.updateMany({
    where: { plant: oldName },
    data: { plant: newName },
  });
  return { updated: result.count };
}

export async function deleteBlock(name: string): Promise<{ updated: number }> {
  const result = await prisma.part.updateMany({
    where: { plant: name },
    data: { plant: null },
  });
  return { updated: result.count };
}

export async function mergeBlocks(
  sourceNames: string[],
  target: string
): Promise<{ updated: number }> {
  const result = await prisma.part.updateMany({
    where: { plant: { in: sourceNames } },
    data: { plant: target },
  });
  return { updated: result.count };
}
