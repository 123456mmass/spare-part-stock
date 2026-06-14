/**
 * Read-only DB tool functions for LINE AI Assistant.
 *
 * Every function accepts plain JSON-safe args and returns plain JSON-safe output.
 * NEVER expose Prisma objects, base64, or secrets in output.
 * Default limit is clamped to 10–20 rows.
 * All total counts come from real DB aggregates, never LLM hallucination.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { searchPartsForLine } from "@/lib/line-chat/tools";
import { normalizeBuildingName } from "@/lib/ai-assistant/intent-normalizer";

// ── Shared types ────────────────────────────────────────────────────

export type DbToolInput = {
  keyword?: string | null;
  plant?: string | null;
  buildingName?: string | null;
  buildingId?: string | null;
  categoryName?: string | null;
  limit?: number | null;
  from?: string | null;
  to?: string | null;
};

export type CleanPart = {
  partNumber: string;
  partName: string;
  quantity: number;
  minimumQuantity: number;
  unit: string;
  location: string | null;
  plant: string | null;
  buildingName: string | null;
  categoryName: string | null;
};

export type SearchPartsResult = {
  parts: CleanPart[];
  totalCount: number;
  totalQuantity: number;
  keyword: string;
};

export type StockSummaryBreakdown = {
  buildingName: string;
  totalParts: number;
  totalQuantity: number;
  plants: {
    plant: string;
    totalParts: number;
    totalQuantity: number;
  }[];
};

export type StockSummaryResult = {
  totalParts: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  inStockCount: number;
  examples: CleanPart[];
  plant: string | null;
  buildingName: string | null;
  categoryName: string | null;
  keyword: string | null;
  breakdown: StockSummaryBreakdown[];
};

export type LowStockResult = {
  parts: CleanPart[];
  totalCount: number;
  plant: string | null;
  buildingName: string | null;
  categoryName: string | null;
};

export type MovementResult = {
  movements: Array<{
    id: string;
    type: string;
    partNumber: string;
    partName: string;
    quantityChange: number;
    quantityBefore: number;
    quantityAfter: number;
    userName: string | null;
    note: string | null;
    createdAt: string;
  }>;
  totalCount: number;
  filters: string;
};

export type TrendResult = {
  monthly: Array<{
    yearMonth: string;
    stockInCount: number;
    stockOutCount: number;
    adjustmentCount: number;
    totalIn: number;
    totalOut: number;
  }>;
  summary: string;
  filters: string;
};

// ── Helpers ─────────────────────────────────────────────────────────

function clampLimit(limit: number | null | undefined): number {
  if (!limit || limit < 1) return 10;
  return Math.min(limit, 20);
}

function toCleanPart(p: Record<string, unknown>): CleanPart {
  return {
    partNumber: String(p.partNumber ?? ""),
    partName: String(p.partName ?? ""),
    quantity: Number(p.quantity ?? 0),
    minimumQuantity: Number(p.minimumQuantity ?? 0),
    unit: String(p.unit ?? "pcs"),
    location: p.location ? String(p.location) : null,
    plant: p.plant ? String(p.plant) : null,
    buildingName: extractRelName(p, "building"),
    categoryName: extractRelName(p, "category"),
  };
}

function extractRelName(obj: Record<string, unknown>, key: string): string | null {
  const val = obj[key];
  if (val && typeof val === "object" && "name" in val) {
    return String((val as Record<string, unknown>).name ?? "");
  }
  return null;
}

function buildKeywordWhere(keyword: string | null | undefined): Prisma.PartWhereInput | null {
  if (!keyword || keyword.trim().length === 0) return null;
  const k = keyword.trim();
  return {
    OR: [
      { partNumber: { contains: k } },
      { partName: { contains: k } },
      { barcodeValue: { contains: k } },
      { description: { contains: k } },
      { subcategory: { contains: k } },
      { category: { is: { name: { contains: k } } } },
    ],
  } as Prisma.PartWhereInput;
}

function buildPartWhere(input: DbToolInput): Prisma.PartWhereInput {
  const ands: Prisma.PartWhereInput[] = [];

  // Always active parts
  ands.push({ isActive: true });

  if (input.plant) {
    ands.push({ plant: input.plant });
  }

  const normalized = normalizeBuildingName(input.buildingName);
  if (normalized) {
    ands.push({ building: { name: normalized } });
  }

  if (input.buildingId) {
    ands.push({ buildingId: input.buildingId });
  }

  if (input.categoryName) {
    ands.push({ category: { name: input.categoryName } });
  }

  // Keyword filter for stock_summary and related tools
  const keywordWhere = buildKeywordWhere(input.keyword);
  if (keywordWhere) {
    ands.push(keywordWhere);
  }

  if (ands.length === 1) {
    return ands[0];
  }
  return { AND: ands };
}

// ── 1. searchPartsTool ──────────────────────────────────────────────

export async function searchPartsTool(input: DbToolInput): Promise<SearchPartsResult> {
  const keyword = input.keyword || "all";
  const limit = clampLimit(input.limit);

  const parts = await searchPartsForLine({
    keyword,
    plant: input.plant ?? undefined,
    building: normalizeBuildingName(input.buildingName) ?? undefined,
    buildingId: input.buildingId ?? undefined,
    limit,
  });

  const cleanParts = parts.slice(0, limit).map((p) => toCleanPart(p as unknown as Record<string, unknown>));

  const totalQuantity = cleanParts.reduce((sum, p) => sum + p.quantity, 0);

  return {
    parts: cleanParts,
    totalCount: parts.length, // searchPartsForLine returns all matches already
    totalQuantity,
    keyword,
  };
}

// ── 2. getStockSummaryTool ──────────────────────────────────────────

export async function getStockSummaryTool(input: DbToolInput): Promise<StockSummaryResult> {
  const where = buildPartWhere(input) as Prisma.PartWhereInput;
  const limit = clampLimit(input.limit);

  const [totalParts, agg, allParts] = await Promise.all([
    prisma.part.count({ where }),
    prisma.part.aggregate({ where, _sum: { quantity: true } }),
    prisma.part.findMany({
      where,
      include: {
        category: { select: { name: true } },
        building: { select: { name: true } },
      },
      orderBy: { quantity: "asc" },
      take: limit,
    }),
  ]);

  const totalQuantity = agg._sum.quantity ?? 0;

  // Low stock & out of stock — count from full set, not just samples
  // Also collect breakdown by building → plant (block)
  const allPartsForCounting = await prisma.part.findMany({
    where,
    select: {
      quantity: true,
      minimumQuantity: true,
      plant: true,
      building: { select: { name: true } },
    },
  });

  const lowStockCount = allPartsForCounting.filter((p) => p.quantity > 0 && p.quantity <= p.minimumQuantity).length;
  const outOfStockCount = allPartsForCounting.filter((p) => p.quantity <= 0).length;
  const inStockCount = totalParts - lowStockCount - outOfStockCount;

  const breakdown = buildStockSummaryBreakdown(allPartsForCounting);

  return {
    totalParts,
    totalQuantity,
    lowStockCount,
    outOfStockCount,
    inStockCount,
    examples: allParts.map((p) => toCleanPart(p as unknown as Record<string, unknown>)),
    plant: input.plant ?? null,
    buildingName: input.buildingName ?? null,
    categoryName: input.categoryName ?? null,
    keyword: input.keyword ?? null,
    breakdown,
  };
}

function buildStockSummaryBreakdown(
  parts: Array<{
    quantity: number;
    minimumQuantity: number;
    plant: string | null;
    building: { name: string | null } | null;
  }>,
): StockSummaryBreakdown[] {
  const map = new Map<string, { totalParts: number; totalQuantity: number; plants: Map<string, { totalParts: number; totalQuantity: number }> }>();

  for (const p of parts) {
    const buildingName = p.building?.name ?? "ไม่ระบุอาคาร";
    const plant = p.plant ?? "ไม่ระบุบล็อค";

    let building = map.get(buildingName);
    if (!building) {
      building = { totalParts: 0, totalQuantity: 0, plants: new Map() };
      map.set(buildingName, building);
    }
    building.totalParts += 1;
    building.totalQuantity += p.quantity;

    let plantGroup = building.plants.get(plant);
    if (!plantGroup) {
      plantGroup = { totalParts: 0, totalQuantity: 0 };
      building.plants.set(plant, plantGroup);
    }
    plantGroup.totalParts += 1;
    plantGroup.totalQuantity += p.quantity;
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1].totalQuantity - a[1].totalQuantity)
    .map(([buildingName, b]) => ({
      buildingName,
      totalParts: b.totalParts,
      totalQuantity: b.totalQuantity,
      plants: Array.from(b.plants.entries())
        .sort((a, b) => b[1].totalQuantity - a[1].totalQuantity)
        .map(([plant, g]) => ({ plant, totalParts: g.totalParts, totalQuantity: g.totalQuantity })),
    }));
}

// ── 3. getLowStockTool ──────────────────────────────────────────────

export async function getLowStockTool(input: DbToolInput): Promise<LowStockResult> {
  const where = buildPartWhere(input) as Prisma.PartWhereInput;
  const limit = clampLimit(input.limit);

  // Get all low/out-of-stock parts
  const allParts = await prisma.part.findMany({
    where: {
      ...where,
      quantity: { lte: prisma.part.fields.minimumQuantity },
    },
    include: {
      category: { select: { name: true } },
      building: { select: { name: true } },
    },
    orderBy: { quantity: "asc" },
  });

  const cleanParts = allParts.slice(0, limit).map((p) => toCleanPart(p as unknown as Record<string, unknown>));

  return {
    parts: cleanParts,
    totalCount: allParts.length,
    plant: input.plant ?? null,
    buildingName: input.buildingName ?? null,
    categoryName: input.categoryName ?? null,
  };
}

// ── 4. getPartMovementsTool ─────────────────────────────────────────

export async function getPartMovementsTool(input: DbToolInput): Promise<MovementResult> {
  const limit = clampLimit(input.limit);

  // Build movement where clause
  const movementWhere: Record<string, unknown> = {};

  if (input.from || input.to) {
    const createdAt: Record<string, Date> = {};
    if (input.from) createdAt.gte = new Date(input.from);
    if (input.to) createdAt.lte = new Date(input.to);
    movementWhere.createdAt = createdAt;
  }

  // Part filters
  const partWhere: Record<string, unknown> = { isActive: true };
  if (input.plant) partWhere.plant = input.plant;
  if (input.buildingName) {
    const norm = normalizeBuildingName(input.buildingName);
    if (norm) partWhere.building = { name: norm };
  }
  if (input.categoryName) partWhere.category = { name: input.categoryName };
  if (input.keyword) {
    partWhere.OR = [
      { partNumber: { contains: input.keyword } },
      { partName: { contains: input.keyword } },
    ];
  }

  if (Object.keys(partWhere).length > 1) {
    movementWhere.part = partWhere;
  }

  // Count
  const totalCount = await prisma.stockMovement.count({
    where: movementWhere as Prisma.StockMovementWhereInput,
  });

  // Fetch
  const movements = await prisma.stockMovement.findMany({
    where: movementWhere as Prisma.StockMovementWhereInput,
    include: {
      part: { select: { partNumber: true, partName: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const normalizedBuilding = normalizeBuildingName(input.buildingName);
  const filters: string[] = [];
  if (input.keyword) filters.push(`คำค้น: ${input.keyword}`);
  if (input.plant) filters.push(`บล็อค ${input.plant}`);
  if (normalizedBuilding) filters.push(`อาคาร ${normalizedBuilding}`);
  if (input.categoryName) filters.push(input.categoryName);
  if (input.from || input.to) {
    filters.push(`ช่วง ${input.from || "?"} – ${input.to || "?"}`);
  }

  return {
    movements: movements.map((m) => ({
      id: m.id,
      type: m.type,
      partNumber: m.part.partNumber,
      partName: m.part.partName,
      quantityChange: m.quantityChange,
      quantityBefore: m.quantityBefore,
      quantityAfter: m.quantityAfter,
      userName: m.user?.name ?? null,
      note: m.note ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
    totalCount,
    filters: filters.join(" | ") || "ทั้งหมด",
  };
}

// ── 5. getUsageTrendsTool ───────────────────────────────────────────

export async function getUsageTrendsTool(input: DbToolInput): Promise<TrendResult> {
  // Default: last 6 months
  const to = input.to ? new Date(input.to) : new Date();
  const from = input.from ? new Date(input.from) : new Date(to.getFullYear(), to.getMonth() - 5, 1);

  const partWhere: Record<string, unknown> = { isActive: true };
  if (input.plant) partWhere.plant = input.plant;
  if (input.buildingName) {
    const norm = normalizeBuildingName(input.buildingName);
    if (norm) partWhere.building = { name: norm };
  }
  if (input.categoryName) partWhere.category = { name: input.categoryName };
  if (input.keyword) {
    partWhere.OR = [
      { partNumber: { contains: input.keyword } },
      { partName: { contains: input.keyword } },
    ];
  }

  const movementWhere = {
    createdAt: { gte: from, lte: to },
  } as Prisma.StockMovementWhereInput;

  if (Object.keys(partWhere).length > 1) {
    movementWhere.part = partWhere as Prisma.PartWhereInput;
  }

  // Fetch movements within date range
  const movements = await prisma.stockMovement.findMany({
    where: movementWhere,
    select: {
      type: true,
      quantityChange: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by year-month
  const monthlyMap = new Map<string, { stockInCount: number; stockOutCount: number; adjustmentCount: number; totalIn: number; totalOut: number }>();

  for (const m of movements) {
    const d = new Date(m.createdAt);
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    let entry = monthlyMap.get(yearMonth);
    if (!entry) {
      entry = { stockInCount: 0, stockOutCount: 0, adjustmentCount: 0, totalIn: 0, totalOut: 0 };
      monthlyMap.set(yearMonth, entry);
    }

    if (m.type === "STOCK_IN") {
      entry.stockInCount++;
      entry.totalIn += m.quantityChange;
    } else if (m.type === "STOCK_OUT") {
      entry.stockOutCount++;
      entry.totalOut += Math.abs(m.quantityChange);
    } else if (m.type === "ADJUSTMENT") {
      entry.adjustmentCount++;
    }
  }

  const monthly = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, data]) => ({ yearMonth, ...data }));

  const totalMovements = movements.length;
  const totalInMovements = movements.filter((m) => m.type === "STOCK_IN").length;
  const totalOutMovements = movements.filter((m) => m.type === "STOCK_OUT").length;

  const trendBuilding = normalizeBuildingName(input.buildingName);
  const filters: string[] = [];
  if (input.keyword) filters.push(`คำค้น: ${input.keyword}`);
  if (input.plant) filters.push(`บล็อค ${input.plant}`);
  if (trendBuilding) filters.push(`อาคาร ${trendBuilding}`);
  if (input.categoryName) filters.push(input.categoryName);

  return {
    monthly,
    summary: `${totalMovements} รายการ (รับเข้า ${totalInMovements}, เบิก/ตัด ${totalOutMovements}) ตั้งแต่ ${from.toLocaleDateString("th-TH")} – ${to.toLocaleDateString("th-TH")}`,
    filters: filters.join(" | ") || "ทั้งหมด",
  };
}

