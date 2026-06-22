import { prisma } from "./prisma";

type PartSlice = {
  quantity: number;
  plant: string | null;
  isSpecialToolPart: boolean;
  categoryId: string | null;
};

const SPECIAL_TOOL_PART_LABEL = "Special Tool Part";
const UNSPECIFIED_BLOCK_LABEL = "ไม่ระบุ Block";

function resolveBlockName(part: PartSlice): string {
  if (part.isSpecialToolPart) return SPECIAL_TOOL_PART_LABEL;
  return part.plant?.trim() || UNSPECIFIED_BLOCK_LABEL;
}

export interface BlockBreakdown {
  block: string;
  partCount: number;
  totalQuantity: number;
  categoryCount: number;
}

export interface BuildingSummary {
  id: string;
  name: string;
  partCount: number;
  totalQuantity: number;
  categoryCount: number;
  blocks: BlockBreakdown[];
}

export interface BlockSummary {
  block: string;
  partCount: number;
  totalQuantity: number;
  categoryCount: number;
}

export interface StorageSummary {
  totals: {
    totalParts: number;
    totalQuantity: number;
    totalCategories: number;
    lowStockCount: number;
  };
  buildings: BuildingSummary[];
  blockSummaries: BlockSummary[];
  recentMovements: {
    id: string;
    type: string;
    quantityChange: number;
    createdAt: Date;
    part: { id: string; partNumber: string; partName: string };
    user: { name: string | null };
  }[];
}

type BlockAccumulator = {
  partCount: number;
  totalQuantity: number;
  categoryIds: Set<string>;
};

function aggregateBlockMap(parts: PartSlice[]) {
  const blockMap = new Map<string, BlockAccumulator>();
  const buildingCategoryIds = new Set<string>();
  let totalQty = 0;

  for (const part of parts) {
    totalQty += part.quantity;
    if (part.categoryId) {
      buildingCategoryIds.add(part.categoryId);
    }

    const block = resolveBlockName(part);
    const existing = blockMap.get(block) ?? {
      partCount: 0,
      totalQuantity: 0,
      categoryIds: new Set<string>(),
    };
    existing.partCount += 1;
    existing.totalQuantity += part.quantity;
    if (part.categoryId) {
      existing.categoryIds.add(part.categoryId);
    }
    blockMap.set(block, existing);
  }

  const blocks: BlockBreakdown[] = Array.from(blockMap.entries())
    .map(([block, stats]) => ({
      block,
      partCount: stats.partCount,
      totalQuantity: stats.totalQuantity,
      categoryCount: stats.categoryIds.size,
    }))
    .sort((a, b) => b.partCount - a.partCount);

  return {
    partCount: parts.length,
    totalQuantity: totalQty,
    categoryCount: buildingCategoryIds.size,
    blocks,
  };
}

function computeBlockSummaries(
  buildings: { parts: PartSlice[] }[]
): BlockSummary[] {
  const blockMap = new Map<string, BlockAccumulator>();

  for (const building of buildings) {
    for (const part of building.parts) {
      const block = resolveBlockName(part);
      const existing = blockMap.get(block) ?? {
        partCount: 0,
        totalQuantity: 0,
        categoryIds: new Set<string>(),
      };
      existing.partCount += 1;
      existing.totalQuantity += part.quantity;
      if (part.categoryId) {
        existing.categoryIds.add(part.categoryId);
      }
      blockMap.set(block, existing);
    }
  }

  return Array.from(blockMap.entries())
    .map(([block, stats]) => ({
      block,
      partCount: stats.partCount,
      totalQuantity: stats.totalQuantity,
      categoryCount: stats.categoryIds.size,
    }))
    .sort((a, b) => b.partCount - a.partCount);
}

export async function getStorageSummary(): Promise<StorageSummary> {
  const [totalParts, totalQuantity, totalCategories, lowStockCandidates, buildings, recentMovements] =
    await Promise.all([
      prisma.part.count({ where: { isActive: true } }),
      prisma.part.aggregate({
        where: { isActive: true },
        _sum: { quantity: true },
      }),
      prisma.category.count(),
      prisma.part.findMany({
        where: { isActive: true, quantity: { gt: 0 } },
        select: { quantity: true, minimumQuantity: true },
      }),
      prisma.building.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          parts: {
            where: { isActive: true },
            select: { quantity: true, plant: true, isSpecialToolPart: true, categoryId: true },
          },
        },
      }),
      prisma.stockMovement.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          part: { select: { id: true, partNumber: true, partName: true } },
          user: { select: { name: true } },
        },
      }),
    ]);

  const buildingSummaries: BuildingSummary[] = buildings.map((b) => {
    const stats = aggregateBlockMap(b.parts);
    return {
      id: b.id,
      name: b.name,
      partCount: stats.partCount,
      totalQuantity: stats.totalQuantity,
      categoryCount: stats.categoryCount,
      blocks: stats.blocks,
    };
  });

  const blockSummaries = computeBlockSummaries(buildings);
  const lowStockCount = lowStockCandidates.filter(
    (p) => p.quantity <= p.minimumQuantity
  ).length;

  return {
    totals: {
      totalParts,
      totalQuantity: totalQuantity._sum.quantity ?? 0,
      totalCategories,
      lowStockCount,
    },
    buildings: buildingSummaries,
    blockSummaries,
    recentMovements,
  };
}
