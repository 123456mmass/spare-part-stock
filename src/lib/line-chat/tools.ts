// Tool definitions and executors for LINE AI Chat
// ให้ LLM เรียกใช้ tools เพื่อเข้าถึงฐานข้อมูล

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { callPartAi, parseJsonObject } from "@/lib/ai-client";
import { resolvePartFromCode } from "@/lib/part-lookup";
import { getStorageSummary } from "@/lib/storage-summary";
import { embedImageWithMetadata, cosineSimilarity, bytesToFloat32 } from "@/lib/embeddings";
import { rerankByVision } from "@/lib/image-rerank";
import { suggestPartFromImage } from "@/lib/part-ai";

// Tool definitions สำหรับ OpenAI function calling format
export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_parts",
      description:
        "ค้นหาอะไหล่จากชื่อ, รหัส, หรือตำแหน่ง คืนผลลัพธ์สูงสุด 5 รายการ",
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
          building: {
            type: "string",
            description: "ชื่ออาคารหรือรหัสอาคาร เช่น 'พ.003' (optional)",
          },
          plant: {
            type: "string",
            description: "ชื่อ Block เช่น 'BLOCK 1' (optional)",
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
      description:
        "ดูสถิติสต็อกโดยรวม: จำนวนอะไหล่ทั้งหมด, ต่ำกว่าขั้นต่ำ, หมด",
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

export type LinePartSearchArgs = {
  keyword: string;
  buildingId?: string;
  building?: string;
  plant?: string;
  limit?: number;
};

export type LinePartSearchResult = Omit<Prisma.PartGetPayload<{
  include: {
    category: { select: { name: true } };
    building: { select: { name: true } };
  };
}>, "imageEmbedding"> & { imageEmbedding?: Buffer | Uint8Array | null };

export type LineImageSearchResult = {
  keyword: string;
  parts: LinePartSearchResult[];
};

export function parseLineInventoryQuery(
  text: string,
): LinePartSearchArgs | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const hasPartTerm =
    hasKnownPartTerm(normalized) || isLikelyPartCode(normalized);
  const findMatch = normalized.match(/(?:^|\s)หา\s*(\S+)/i);
  const findTarget = findMatch?.[1]?.trim() || "";
  const isWorkflowQuestion =
    /(วิธี|ยังไง|อย่างไร|ทำไง|ขั้นตอน|คู่มือ|ใช้งาน|ทำอะไรได้บ้าง|ทำไรได้บ้าง|ช่วยอะไรได้บ้าง)/i.test(
      normalized,
    );
  const isInventoryIntent =
    /(stock|สต็อก|สต๊อก|อะไหล่|เหลือ|จำนวน|ค้นหา|เช็ค|ตรวจ|มีไหม|มีกี่|กี่ตัว|กี่ชิ้น)/i.test(
      normalized,
    );
  const isFindPartIntent = Boolean(
    findMatch && (hasPartTerm || isLikelyPartCode(findTarget)),
  );
  const isAvailabilityQuestion =
    /(มี|หา).*(ไหม|มั้ย|หรือเปล่า)/i.test(normalized) && hasPartTerm;
  const hasLocator = /(block|บล็อก|อาคาร|ตึก)\s*[\wก-ฮ.]+/i.test(normalized);
  const isLocatorOverview =
    /(อาคาร|ตึก|block|บล็อก)\s*(อะไร|ไหน|ทั้งหมด|บ้าง|กี่|รายการ)/i.test(
      normalized,
    ) ||
    /(อะไร|ไหน|ทั้งหมด|บ้าง|กี่|รายการ).*(อาคาร|ตึก|block|บล็อก)/i.test(
      normalized,
    );

  if (isWorkflowQuestion && !hasPartTerm && !hasLocator) return null;
  if (isLocatorOverview && !hasPartTerm) return null;
  if (
    !isInventoryIntent &&
    !isFindPartIntent &&
    !isAvailabilityQuestion &&
    !hasLocator
  )
    return null;

  const buildingMatch = normalized.match(/(?:อาคาร|ตึก)\s*([^\s,]+)/i);
  const blockMatch = normalized.match(/(?:block|บล็อก)\s*([^\s,]+)/i);
  const building = buildingMatch?.[1]?.trim();
  const plant = blockMatch?.[1]?.trim();

  let keyword = normalized
    .replace(/(?:อาคาร|ตึก)\s*[^\s,]+/gi, " ")
    .replace(/(?:block|บล็อก)\s*[^\s,]+/gi, " ")
    .replace(
      /(stock|สต็อก|สต๊อก|อะไหล่|คงเหลือ|เหลือเท่าไหร่|เหลือกี่ตัว|เหลือกี่ชิ้น|เหลือกี่|จำนวน|ค้นหา|หา|เช็ค|ตรวจ|ในระบบ|ให้หน่อย|ครับ|ค่ะ|คะ|หน่อย|แบบนี้|แลบนี้|ตัวนี้|อันนี้)/gi,
      " ",
    )
    .replace(/(สรุป|สถานะ|รายงาน|summary|report|ของ|สำหรับ)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!keyword && !building && !plant) return null;
  if (!keyword)
    keyword = [plant ? `BLOCK ${plant}` : null, building]
      .filter(Boolean)
      .join(" ");

  return {
    keyword,
    building,
    plant,
  };
}

const SEARCH_SYNONYMS: Array<{ triggers: string[]; terms: string[] }> = [
  {
    triggers: [
      "เบรกเกอร์",
      "เบรกเกอร",
      "เบรคเกอร์",
      "เบรคเกอร",
      "breaker",
      "mcb",
      "mccb",
    ],
    terms: ["breaker", "circuit breaker", "MCB", "MCCB", "เบรกเกอร์"],
  },
  {
    triggers: ["รีเลย์", "รีเลย", "relay"],
    terms: ["relay", "power relay", "relay socket", "รีเลย์"],
  },
  {
    triggers: ["คอนแทคเตอร์", "คอนแทกเตอร์", "contactor"],
    terms: ["contactor", "magnetic contactor", "คอนแทคเตอร์"],
  },
  { triggers: ["ฟิวส์", "fuse"], terms: ["fuse", "ฟิวส์"] },
  {
    triggers: ["เซนเซอร์", "เซนเซอร", "เซ็นเซอร์", "เซ็นเซอร", "sensor"],
    terms: ["sensor", "เซนเซอร์"],
  },
  { triggers: ["วาล์ว", "valve"], terms: ["valve", "solenoid valve", "วาล์ว"] },
  { triggers: ["มอเตอร์", "motor"], terms: ["motor", "มอเตอร์"] },
  {
    triggers: ["ลูกปืน", "bearing"],
    terms: ["bearing", "ball bearing", "ลูกปืน"],
  },
  {
    triggers: ["อินเวอร์เตอร์", "inverter"],
    terms: ["inverter", "drive", "อินเวอร์เตอร์"],
  },
  {
    triggers: ["โอเวอร์โหลด", "overload"],
    terms: ["overload", "thermal overload relay", "โอเวอร์โหลด"],
  },
  {
    triggers: ["สวิตช์", "switch"],
    terms: ["switch", "limit switch", "สวิตช์"],
  },
];

function hasKnownPartTerm(keyword: string): boolean {
  const normalized = keyword.toLowerCase();
  return SEARCH_SYNONYMS.some((group) =>
    [...group.triggers, ...group.terms].some((term) =>
      normalized.includes(term.toLowerCase()),
    ),
  );
}

function isLikelyPartCode(keyword: string): boolean {
  const compact = keyword.replace(/\s+/g, "");
  return /^[A-Z0-9][A-Z0-9._/-]{2,}$/i.test(compact) && /\d/.test(compact);
}

function extractLikelyPartCodes(text: string): string[] {
  const seen = new Set<string>();
  const matches = text.match(/[A-Z0-9][A-Z0-9._/-]{2,}/gi) || [];
  for (const match of matches) {
    const cleaned = match.replace(/^[._/-]+|[._/-]+$/g, "");
    if (cleaned.length >= 3 && /\d/.test(cleaned)) seen.add(cleaned);
  }
  return [...seen].slice(0, 8);
}

function parseKeywordList(text: string): string[] {
  return text
    .replace(/[{}\[\]"]/g, " ")
    .split(/[,;\n\r]+/)
    .map((term) =>
      term
        .replace(/^\s*[-*\d.)]+/, "")
        .replace(/^\s*(keywords?|คำค้นหา)\s*:\s*/i, "")
        .trim(),
    )
    .filter((term) => term.length >= 2 && term.length <= 48)
    .slice(0, 8);
}

async function expandSearchKeywords(keyword: string): Promise<string[]> {
  const cleaned = keyword
    .replace(/[^\p{L}\p{M}\p{N}.\-_/ ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const keywords = new Set<string>();
  if (cleaned) keywords.add(cleaned);
  for (const code of extractLikelyPartCodes(cleaned)) keywords.add(code);

  const cleanedLower = cleaned.toLowerCase();
  for (const synonymGroup of SEARCH_SYNONYMS) {
    if (
      synonymGroup.triggers.some((trigger) =>
        cleanedLower.includes(trigger.toLowerCase()),
      )
    ) {
      for (const synonym of synonymGroup.terms) keywords.add(synonym);
    }
  }

  for (const token of cleaned.split(" ")) {
    if (token.length >= 2) keywords.add(token);
  }

  if (cleaned && !isLikelyPartCode(cleaned)) {
    try {
      const result = await callPartAi(
        [
          {
            type: "text",
            text: [
              "You convert a user's spare-part inventory search into database search keywords.",
              "Return only one JSON object, no markdown.",
              "The database contains English and Thai part names, part numbers, brands, categories, and descriptions.",
              "Do not answer the user. Do not invent that an item exists.",
              "For Thai terms, add common English industrial equivalents and abbreviations.",
              "Examples:",
              "- เบรกเกอร์ => breaker, circuit breaker, MCB, MCCB",
              "- รีเลย์ => relay, power relay, relay socket",
              "- คอนแทคเตอร์ => contactor, magnetic contactor",
              "- โอเวอร์โหลด => overload, thermal overload relay",
              JSON.stringify({
                query: cleaned,
                outputSchema: {
                  keywords: ["most useful DB search terms, max 8"],
                },
              }),
            ].join("\n"),
          },
        ],
        { maxTokens: 512, temperature: 0, timeoutMs: 20_000 },
      );
      try {
        const parsed = parseJsonObject(result.text) as { keywords?: unknown };
        if (Array.isArray(parsed.keywords)) {
          for (const raw of parsed.keywords) {
            if (typeof raw === "string" && raw.trim()) keywords.add(raw.trim());
          }
        }
      } catch {
        for (const term of parseKeywordList(result.text)) keywords.add(term);
      }
    } catch (error) {
      console.error("LINE search query expansion failed:", error);
    }
  }

  for (const term of [...keywords]) {
    if (/[a-z]/i.test(term)) {
      keywords.add(term.toLowerCase());
      keywords.add(term.toUpperCase());
      keywords.add(
        term.toLowerCase().replace(/\b[a-z]/g, (char) => char.toUpperCase()),
      );
    }
  }

  return [...keywords].filter(Boolean).slice(0, 24);
}

export async function searchPartsForLine(
  args: LinePartSearchArgs,
): Promise<LinePartSearchResult[]> {
  const keyword = args.keyword.trim();
  const limit = args.limit ?? 10;

  if (isLikelyPartCode(keyword)) {
    const exactParts = await prisma.part.findMany({
      where: {
        isActive: true,
        OR: [
          { partNumber: keyword },
          { barcodeValue: keyword },
          { partNumber: { contains: keyword } },
          { barcodeValue: { contains: keyword } },
        ],
      },
      include: {
        category: { select: { name: true } },
        building: { select: { name: true } },
      },
      take: limit,
      orderBy: [{ partNumber: "asc" }],
    });
    if (exactParts.length > 0) return exactParts;
  }

  const keywords = await expandSearchKeywords(keyword);

  async function runSearch(useLocators: boolean) {
    const locatorFilters: Prisma.PartWhereInput[] = [];
    if (useLocators) {
      if (args.buildingId) {
        locatorFilters.push({ buildingId: args.buildingId });
      } else if (args.building) {
        locatorFilters.push({
          building: { is: { name: { contains: args.building } } },
        });
      }

      if (args.plant) {
        const plant = args.plant.trim();
        locatorFilters.push({
          OR: [
            { plant: { contains: plant } },
            { plant: { contains: `BLOCK ${plant}` } },
            { location: { contains: `BLOCK ${plant}` } },
            { location: { contains: plant } },
          ],
        });
      }
    }

    const include = {
      category: { select: { name: true } },
      building: { select: { name: true } },
    } satisfies Prisma.PartInclude;

    const findMany = async (term?: string) => {
      const and: Prisma.PartWhereInput[] = [...locatorFilters];
      if (term) {
        and.push({
          OR: [
            { partNumber: { contains: term } },
            { partName: { contains: term } },
            { barcodeValue: { contains: term } },
            { location: { contains: term } },
            { description: { contains: term } },
            { subcategory: { contains: term } },
            { plant: { contains: term } },
            { category: { is: { name: { contains: term } } } },
            { building: { is: { name: { contains: term } } } },
          ],
        });
      }

      return prisma.part.findMany({
        where: {
          isActive: true,
          ...(and.length > 0 ? { AND: and } : {}),
        },
        include,
        take: Math.max(limit * 4, 30),
        orderBy: [{ quantity: "desc" }, { partNumber: "asc" }],
      });
    };

    const resultSets =
      keywords.length > 0
        ? await Promise.all(keywords.map((term) => findMany(term)))
        : [await findMany()];

    const partsById = new Map<string, LinePartSearchResult>();
    for (const parts of resultSets) {
      for (const part of parts) partsById.set(part.id, part);
    }

    return [...partsById.values()]
      .map((part) => ({ part, score: scorePartSearchMatch(part, keywords) }))
      .sort((a, b) => b.score - a.score || b.part.quantity - a.part.quantity)
      .map(({ part }) => part)
      .slice(0, limit);
  }

  const hasLocators = Boolean(args.buildingId || args.building || args.plant);
  const strictResults = await runSearch(hasLocators);
  if (strictResults.length > 0 || !hasLocators || !keyword)
    return strictResults;

  return runSearch(false);
}

function scorePartSearchMatch(
  part: LinePartSearchResult,
  keywords: string[],
): number {
  const partNumber = part.partNumber.toLowerCase();
  const partName = part.partName.toLowerCase();
  const subcategory = (part.subcategory || "").toLowerCase();
  const category = (part.category?.name || "").toLowerCase();
  const description = (part.description || "").toLowerCase();

  return keywords.reduce((score, term, index) => {
    const normalized = term.toLowerCase();
    if (!normalized) return score;
    const decay = Math.max(12 - index, 1);
    let next = score;
    if (partNumber === normalized) next += 120;
    else if (partNumber.includes(normalized)) next += 70;
    if (partName.includes(normalized)) next += 60 + decay;
    if (subcategory.includes(normalized)) next += 45 + decay;
    if (category.includes(normalized)) next += 35 + decay;
    if (description.includes(normalized)) next += 8;
    return next;
  }, 0);
}

// Execute tool and return result
export async function executeTool(
  name: string,
  args: Record<string, string>,
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
  args: Record<string, string>,
): Promise<string> {
  const { buildingId, plant, building } = args;
  const keyword = args.keyword === "*" ? "" : (args.keyword || "").trim();
  if (!keyword && !buildingId && !plant && !building) return "กรุณาระบุคำค้นหา";

  const isLocatorOnly = !keyword && Boolean(buildingId || building || plant);
  const locatorWhere = buildLocatorWhere({ buildingId, building, plant });
  const [summary, parts] = await Promise.all([
    isLocatorOnly
      ? prisma.part.aggregate({
          where: locatorWhere,
          _count: { id: true },
          _sum: { quantity: true },
        })
      : null,
    searchPartsForLine({
      keyword,
      buildingId,
      building,
      plant,
      limit: isLocatorOnly ? 20 : 8,
    }),
  ]);

  if (parts.length === 0) {
    const scope = [
      building ? `อาคาร ${building}` : null,
      plant ? `Block ${plant}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    return `ไม่พบอะไหล่ที่ตรงกับ "${keyword || scope || "เงื่อนไขที่ระบุ"}"`;
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
      p.plant ? `   🧱 ${p.plant}` : null,
      p.imageUrl ? `   รูป: ${p.imageUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const label =
    keyword ||
    [building ? `อาคาร ${building}` : null, plant ? `Block ${plant}` : null]
      .filter(Boolean)
      .join(" ");
  if (summary) {
    return [
      `ค้นหา "${label}"`,
      `จำนวนจริงใน DB: ${summary._count.id} รายการ`,
      `จำนวนรวมจริงใน DB: ${summary._sum.quantity || 0} ชิ้น`,
      `รายการด้านล่างเป็นตัวอย่าง ${parts.length} รายการแรกเท่านั้น ห้ามสรุปว่า DB มีแค่ ${parts.length} รายการ`,
      "",
      lines.join("\n\n"),
    ].join("\n");
  }

  return `ค้นหา "${label}" พบรายการที่เกี่ยวข้อง ${parts.length} รายการ:\n\n${lines.join("\n\n")}`;
}

function buildLocatorWhere(args: {
  buildingId?: string;
  building?: string;
  plant?: string;
}): Prisma.PartWhereInput {
  const and: Prisma.PartWhereInput[] = [];
  if (args.buildingId) {
    and.push({ buildingId: args.buildingId });
  } else if (args.building) {
    and.push({ building: { is: { name: { contains: args.building } } } });
  }

  if (args.plant) {
    const plant = args.plant.trim();
    and.push({
      OR: [
        { plant: { contains: plant } },
        { plant: { contains: `BLOCK ${plant}` } },
        { location: { contains: `BLOCK ${plant}` } },
        { location: { contains: plant } },
      ],
    });
  }

  return {
    isActive: true,
    ...(and.length > 0 ? { AND: and } : {}),
  };
}

async function handleGetStock(args: Record<string, string>): Promise<string> {
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
    .map(
      (b) => `  🏢 ${b.name}: ${b.partCount} รายการ, ${b.totalQuantity} ชิ้น`,
    )
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

  const lines = buildings.map((b) => `🏢 ${b.name}: ${b._count.parts} รายการ`);

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
    (b) => `🧱 ${b.plant}: ${b._count.id} รายการ, ${b._sum.quantity || 0} ชิ้น`,
  );

  return `Block ทั้งหมด ${blocks.length} แห่ง:\n${lines.join("\n")}`;
}

async function handleSearchByImage(
  args: Record<string, string>,
): Promise<string> {
  const { imageBase64 } = args;
  if (!imageBase64) return "กรุณาส่งรูปภาพ";

  const result = await searchPartsByImageForLine(imageBase64);
  if (result.parts.length === 0) {
    return "ไม่พบอะไหล่ที่คล้ายกับรูปภาพนี้";
  }

  const lines = result.parts.map(
    (part, i) => `${i + 1}. ${part.partNumber} - ${part.partName}`,
  );

  return `พบอะไหล่ที่น่าจะใกล้กับรูปภาพ ${result.parts.length} รายการ:\n${lines.join("\n")}`;
}

export async function searchPartsByImageForLine(
  imageBase64: string,
): Promise<LineImageSearchResult> {
  const buffer = Buffer.from(imageBase64, "base64");
  const visualTerms = await inferImageSearchTerms(buffer);

  let queryEmbedding: Awaited<ReturnType<typeof embedImageWithMetadata>>;
  try {
    queryEmbedding = await embedImageWithMetadata(buffer, "query");
  } catch (err) {
    console.error("embedImage failed:", (err as Error).message);
    return { keyword: "รูปภาพ", parts: [] };
  }

  const parts = await prisma.part.findMany({
    where: {
      isActive: true,
      imageEmbedding: { not: null },
      imageEmbeddingProvider: queryEmbedding.provider,
      imageEmbeddingModel: queryEmbedding.model,
    },
    include: {
      category: { select: { name: true } },
      building: { select: { name: true } },
    },
    take: 1000,
    orderBy: { updatedAt: "desc" },
  });

  const matches = parts
    .map((p) => {
      const vec = bytesToFloat32(p.imageEmbedding as Buffer);
      const similarity = cosineSimilarity(queryEmbedding.vector, vec);
      const textBoost = scoreImageTextMatch(p, visualTerms);
      const { imageEmbedding, ...part } = p;
      void imageEmbedding;
      return { part, similarity, score: similarity + textBoost };
    })
    .filter((m) => m.similarity >= (queryEmbedding.provider === "voyage" ? 0.35 : 0.5))
    .sort((a, b) => b.score - a.score || b.similarity - a.similarity)
    .slice(0, 12);

  if (matches.length === 0) {
    return { keyword: imageKeyword(visualTerms), parts: [] };
  }

  let rankedMatches = matches;
  try {
    rankedMatches = await rerankByVision(
      buffer,
      matches
        .filter((match) => Boolean(match.part.imageUrl))
        .slice(0, 8)
        .map((match) => ({
          ...match,
          id: match.part.id,
          partNumber: match.part.partNumber,
          partName: match.part.partName,
          imageUrl: match.part.imageUrl || "",
        })),
    );
  } catch (error) {
    console.error("image rerank failed:", error);
  }

  const topMatches = rankedMatches.slice(0, 5);
  return {
    keyword: imageKeyword(visualTerms),
    parts: topMatches.map((match) => match.part),
  };
}

async function inferImageSearchTerms(buffer: Buffer): Promise<string[]> {
  try {
    const fileBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
    const file = new File([fileBuffer], "line-image.jpg", { type: "image/jpeg" });
    const suggestion = await suggestPartFromImage(file, {
      allowDbFallback: false,
    });
    const terms = [
      suggestion.partNumber,
      suggestion.partName,
      suggestion.subcategory,
      suggestion.categoryName,
      suggestion.description,
      ...industrialTypeTerms(
        [
          suggestion.partName,
          suggestion.subcategory,
          suggestion.categoryName,
          suggestion.description,
        ].join(" "),
      ),
    ];
    return [...new Set(terms.flatMap(tokenizeSearchTerms))].slice(0, 16);
  } catch (error) {
    console.error("image search term inference failed:", error);
    return [];
  }
}

function imageKeyword(visualTerms: string[]): string {
  return visualTerms.length > 0
    ? `รูปภาพ (${visualTerms.slice(0, 4).join(", ")})`
    : "รูปภาพ";
}

function tokenizeSearchTerms(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}.\-_/ ]/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !/^\d+$/.test(term));
}

function industrialTypeTerms(text: string): string[] {
  const normalized = text.toLowerCase();
  const groups = [
    {
      triggers: ["contactor", "magnetic", "starter"],
      terms: ["contactor", "magnetic contactor", "motor starter", "starter"],
    },
    {
      triggers: ["overload", "thermal"],
      terms: ["overload", "thermal overload", "thermal overload relay"],
    },
    {
      triggers: ["breaker", "circuit", "mcb", "mccb"],
      terms: ["breaker", "circuit breaker", "mcb", "mccb"],
    },
    { triggers: ["relay"], terms: ["relay", "power relay"] },
  ];
  return groups
    .filter((group) =>
      group.triggers.some((trigger) => normalized.includes(trigger)),
    )
    .flatMap((group) => group.terms);
}

function scoreImageTextMatch(
  part: {
    partNumber: string;
    partName: string;
    description: string | null;
    subcategory: string | null;
  },
  visualTerms: string[],
): number {
  if (visualTerms.length === 0) return 0;
  const haystack = [
    part.partNumber,
    part.partName,
    part.subcategory || "",
    part.description || "",
  ]
    .join(" ")
    .toLowerCase();
  return visualTerms.reduce((score, term) => {
    if (!term) return score;
    if (haystack.includes(term)) return score + 0.12;
    return score;
  }, 0);
}
