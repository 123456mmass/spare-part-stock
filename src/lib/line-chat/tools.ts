// Tool definitions and executors for LINE AI Chat
// ให้ LLM เรียกใช้ tools เพื่อเข้าถึงฐานข้อมูล

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolvePartFromCode } from "@/lib/part-lookup";
import { getStorageSummary } from "@/lib/storage-summary";
import { embedImage, cosineSimilarity, bytesToFloat32 } from "@/lib/embeddings";

// Tool definitions สำหรับ OpenAI function calling format
export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_parts",
      description: "ค้นหาอะไหล่จากชื่อ, รหัส, หรือตำแหน่ง คืนผลลัพธ์สูงสุด 5 รายการ",
      parameters: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "คำค้นหา เช่น 'contactor', 'relay', 'LC1D09'",
          },
          buildingId: {
            type: "string",
            description: "ID ของอาคาร (optional)",
          },
          plant: {
            type: "string",
            description: "ชื่อ Block (optional)",
          },
        },
        required: ["keyword"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_stock",
      description: "ดูจำนวนสต็อกของอะไหล่จากรหัสหรือบาร์โค้ด",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "รหัสอะไหล่, บาร์โค้ด, หรือ URL",
          },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_stock_stats",
      description: "ดูสถิติสต็อกโดยรวม: จำนวนอะไหล่ทั้งหมด, ต่ำกว่าขั้นต่ำ, หมด",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_buildings",
      description: "ดูรายการอาคารทั้งหมดพร้อมจำนวนอะไหล่",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_blocks",
      description: "ดูรายการ Block ทั้งหมดพร้อมจำนวนอะไหล่",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_by_image",
      description: "ค้นหาอะไหล่ที่คล้ายกับรูปภาพที่ส่งมา (ใช้ CLIP embeddings)",
      parameters: {
        type: "object",
        properties: {
          imageBase64: {
            type: "string",
            description: "Base64 ของรูปภาพ",
          },
        },
        required: ["imageBase64"],
      },
    },
  },
];

// Execute tool and return result
export async function executeTool(
  name: string,
  args: Record<string, string>
): Promise<string> {
  try {
    switch (name) {
      case "search_parts":
        return await handleSearchParts(args);
      case "get_stock":
        return await handleGetStock(args);
      case "get_stock_stats":
        return await handleGetStockStats();
      case "list_buildings":
        return await handleListBuildings();
      case "list_blocks":
        return await handleListBlocks();
      case "search_by_image":
        return await handleSearchByImage(args);
      default:
        return `Tool "${name}" ไม่รู้จัก`;
    }
  } catch (error) {
    console.error(`Tool ${name} error:`, error);
    return `เกิดข้อผิดพลาดในการเรียกใช้ ${name}`;
  }
}

async function handleSearchParts(
  args: Record<string, string>
): Promise<string> {
  const { keyword, buildingId, plant } = args;
  if (!keyword) return "กรุณาระบุคำค้นหา";

  const where: Prisma.PartWhereInput = {
    isActive: true,
    OR: [
      { partNumber: { contains: keyword } },
      { partName: { contains: keyword } },
      { location: { contains: keyword } },
      { description: { contains: keyword } },
    ],
  };

  if (buildingId) where.buildingId = buildingId;
  if (plant) where.plant = plant;

  const parts = await prisma.part.findMany({
    where,
    include: {
      category: { select: { name: true } },
      building: { select: { name: true } },
    },
    take: 5,
    orderBy: { partNumber: "asc" },
  });

  if (parts.length === 0) {
    return `ไม่พบอะไหล่ที่ตรงกับ "${keyword}"`;
  }

  const lines = parts.map((p) => {
    const status =
      p.quantity <= 0
        ? "❌ หมด"
        : p.quantity <= p.minimumQuantity
        ? "⚠️ ต่ำกว่าขั้นต่ำ"
        : "✅ คงเหลือ";
    return [
      `📦 ${p.partNumber} - ${p.partName}`,
      `   จำนวน: ${p.quantity} ${p.unit || "pcs"} | ${status}`,
      p.location ? `   📍 ${p.location}` : null,
      p.category?.name ? `   🏷️ ${p.category.name}` : null,
      p.building?.name ? `   🏢 ${p.building.name}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return `ค้นหา "${keyword}" พบ ${parts.length} รายการ:\n\n${lines.join("\n\n")}`;
}

async function handleGetStock(
  args: Record<string, string>
): Promise<string> {
  const { code } = args;
  if (!code) return "กรุณาระบุรหัสอะไหล่";

  const part = await resolvePartFromCode(code);
  if (!part) {
    return `ไม่พบ "${code}" ในระบบ`;
  }

  const status =
    part.quantity <= 0
      ? "❌ หมด"
      : part.quantity <= part.minimumQuantity
      ? "⚠️ ต่ำกว่าขั้นต่ำ"
      : "✅ คงเหลือ";

  return [
    `📦 ${part.partNumber} - ${part.partName}`,
    `   จำนวน: ${part.quantity} ${part.unit || "pcs"}`,
    `   ขั้นต่ำ: ${part.minimumQuantity}`,
    `   สถานะ: ${status}`,
    part.location ? `   📍 ${part.location}` : null,
    part.category?.name ? `   🏷️ ${part.category.name}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function handleGetStockStats(): Promise<string> {
  const summary = await getStorageSummary();
  const { totals, buildings } = summary;

  const buildingLines = buildings
    .map((b) => `  🏢 ${b.name}: ${b.partCount} รายการ, ${b.totalQuantity} ชิ้น`)
    .join("\n");

  return [
    `📊 สรุปสต็อกอะไหล่`,
    `━━━━━━━━━━━━━━━━━━`,
    `📦 อะไหล่ทั้งหมด: ${totals.totalParts} รายการ`,
    `📊 จำนวนรวม: ${totals.totalQuantity} ชิ้น`,
    `⚠️ ต่ำกว่าขั้นต่ำ: ${totals.lowStockCount} รายการ`,
    `🏷️ หมวดหมู่: ${totals.totalCategories} หมวด`,
    ``,
    `🏢 แยกตามอาคาร:`,
    buildingLines,
  ].join("\n");
}

async function handleListBuildings(): Promise<string> {
  const buildings = await prisma.building.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { parts: true } },
    },
    orderBy: { name: "asc" },
  });

  if (buildings.length === 0) {
    return "ยังไม่มีอาคารในระบบ";
  }

  const lines = buildings.map(
    (b) => `🏢 ${b.name}: ${b._count.parts} รายการ`
  );

  return `อาคารทั้งหมด ${buildings.length} แห่ง:\n${lines.join("\n")}`;
}

async function handleListBlocks(): Promise<string> {
  const blocks = await prisma.part.groupBy({
    by: ["plant"],
    where: { isActive: true, plant: { not: null } },
    _count: { id: true },
    _sum: { quantity: true },
    orderBy: { _count: { id: "desc" } },
  });

  if (blocks.length === 0) {
    return "ยังไม่มี Block ในระบบ";
  }

  const lines = blocks.map(
    (b) => `🧱 ${b.plant}: ${b._count.id} รายการ, ${b._sum.quantity || 0} ชิ้น`
  );

  return `Block ทั้งหมด ${blocks.length} แห่ง:\n${lines.join("\n")}`;
}

async function handleSearchByImage(
  args: Record<string, string>
): Promise<string> {
  const { imageBase64 } = args;
  if (!imageBase64) return "กรุณาส่งรูปภาพ";

  const buffer = Buffer.from(imageBase64, "base64");

  let queryVec: Float32Array;
  try {
    queryVec = await embedImage(buffer);
  } catch (err) {
    console.error("embedImage failed:", (err as Error).message);
    return "ระบบค้นหาด้วยรูปไม่พร้อมใช้งาน";
  }

  const parts = await prisma.part.findMany({
    where: { isActive: true, imageEmbedding: { not: null } },
    select: {
      id: true,
      partNumber: true,
      partName: true,
      imageUrl: true,
      quantity: true,
      unit: true,
      location: true,
      imageEmbedding: true,
    },
  });

  const matches = parts
    .map((p) => {
      const vec = bytesToFloat32(p.imageEmbedding as Buffer);
      const similarity = cosineSimilarity(queryVec, vec);
      const { imageEmbedding, ...part } = p;
      void imageEmbedding;
      return { part, similarity };
    })
    .filter((m) => m.similarity >= 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  if (matches.length === 0) {
    return "ไม่พบอะไหล่ที่คล้ายกับรูปภาพนี้";
  }

  const lines = matches.map(
    (m, i) =>
      `${i + 1}. ${m.part.partNumber} - ${m.part.partName} (ความคล้าย: ${Math.round(m.similarity * 100)}%)`
  );

  return `พบอะไหล่ที่คล้ายกับรูปภาพ ${matches.length} รายการ:\n${lines.join("\n")}`;
}
