/**
 * LLM intent normalizer for LINE Assistant.
 *
 * Takes a Thai/English text query and returns a structured intent classification.
 * Uses the current text model via callPartAi. Falls back to general_chat on any failure.
 */

import { z } from "zod";
import { callPartAi, parseJsonObject } from "@/lib/ai-client";

// ── Output types ────────────────────────────────────────────────────

export type InventoryIntent =
  | "inventory_search"
  | "stock_summary"
  | "low_stock"
  | "movement_history"
  | "usage_trend"
  | "general_chat";

export type NormalizedIntent = {
  intent: InventoryIntent;
  keyword: string | null;
  plant: string | null;
  buildingName: string | null;
  categoryName: string | null;
  from: string | null;
  to: string | null;
  confidence: number;
};

// ── Zod schema for LLM output ───────────────────────────────────────

const intentSchema = z.object({
  intent: z.enum([
    "inventory_search",
    "stock_summary",
    "low_stock",
    "movement_history",
    "usage_trend",
    "general_chat",
  ]),
  keyword: z.string().nullable().default(null),
  plant: z.string().nullable().default(null),
  buildingName: z.string().nullable().default(null),
  categoryName: z.string().nullable().default(null),
  from: z.string().nullable().default(null),
  to: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0),
});

// ── System prompt ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a Thai/English inventory query classifier. Your job is to analyze a user's message about spare parts stock and return ONLY a JSON object. Never include any other text before or after the JSON.

## Intent types

- "inventory_search": searching for a specific part or type of part (keywords: ค้นหา, หา, มี...ไหม, ดู, อยากได้, เช็ค)
- "stock_summary": asking for overall stock status/summary (keywords: สรุป, ภาพรวม, สถานะ, เหลือเท่าไหร่, คงเหลือ, หมดกี่ตัว, สต็อกเท่าไหร่)
- "low_stock": asking about low stock / near-empty items (keywords: ใกล้หมด, ต่ำกว่าขั้นต่ำ, ต้องเติม, อะไรหมด, อันไหนใกล้หมด)
- "movement_history": asking about recent stock movements (keywords: เบิก, ไปกี่ตัว, ประวัติ, ล่าสุด, ครั้งล่าสุด, เมื่อวาน)
- "usage_trend": asking about trends over time (keywords: เดือนนี้, สัปดาห์นี้, ปีนี้, แนวโน้ม, สถิติ, ใช้ไป, usage, trend, กี่ครั้ง)
- "general_chat": anything not related to spare parts inventory (weather, casual talk, greetings, how-to, definitions, etc.)

## How to extract fields

- "บล็อค", "บล็อก", "block", "บล้อค" followed by a number → plant (e.g. "บล็อค 2" → plant="2")
- "อาคาร", "ตึก" followed by "ท.xxx" or building code → buildingName (e.g. "อาคาร ท.003" → buildingName="ท.003")
- The main search term → keyword (e.g. "เบรกเกอร์", "contactor", "LC1D40AP7")
- Category terms like "หมวดอุปกรณ์ไฟฟ้า" → categoryName
- Date ranges → from/to (ISO format YYYY-MM-DD if explicit, otherwise null)

## Rules

1. NEVER invent plant, buildingName, categoryName, or dates that are not explicitly in the text.
2. If you're unsure about the intent (confidence < 0.7), fall back to "general_chat".
3. If the text mentions both a search term AND summary keywords, prefer the intent that matches the main question.
4. Stock quantity questions ("เหลือเท่าไหร่", "มีกี่ตัว") about a specific part → "inventory_search", NOT "stock_summary"
5. Questions about "all parts" or "all stock" with filters → "stock_summary"
6. Questions about parts that are depleted or near-depleted → "low_stock"

Output ONLY this JSON object:
{"intent":"...","keyword":"...", "plant":"...", "buildingName":"...", "categoryName":"...", "from":"...", "to":"...", "confidence":0.0}`;

// ── Default fallback ────────────────────────────────────────────────

const DEFAULT_INTENT: NormalizedIntent = {
  intent: "general_chat",
  keyword: null,
  plant: null,
  buildingName: null,
  categoryName: null,
  from: null,
  to: null,
  confidence: 0,
};

// ── Main function ───────────────────────────────────────────────────

/**
 * Classify a user's text query into a structured inventory intent.
 * Uses the current text model. Falls back to general_chat on any failure.
 */
export async function normalizeIntent(text: string): Promise<NormalizedIntent> {
  try {
    const result = await callPartAi([
      { type: "text", text: `${SYSTEM_PROMPT}\n\nUser message: "${text}"` },
    ], {
      maxTokens: 200,
      temperature: 0.1,
      timeoutMs: 10_000,
    });

    const parsed = parseJsonObject(result.text);
    if (!parsed || typeof parsed !== "object") return DEFAULT_INTENT;

    const validated = intentSchema.safeParse(parsed);
    if (!validated.success) return DEFAULT_INTENT;

    const data = validated.data;

    // Enforce minimum confidence
    if (data.confidence < 0.7) {
      return { ...DEFAULT_INTENT };
    }

    return {
      intent: data.intent,
      keyword: data.keyword || null,
      plant: data.plant || null,
      buildingName: data.buildingName || null,
      categoryName: data.categoryName || null,
      from: data.from || null,
      to: data.to || null,
      confidence: data.confidence,
    };
  } catch {
    return DEFAULT_INTENT;
  }
}

// ── Deterministic rule-based pre-normalization ─────────────────────

/**
 * Detect if a text is asking about a stock *summary* (overall status) rather
 * than searching for a specific part.  Matches patterns like:
 *   "สรุปสถานะสต็อกบล็อค 1 อาคาร ท.003"
 *   "ภาพรวมอะไหล่"
 *   "สถานะสต็อกตอนนี้"
 *   "อะไหล่ใกล้หมดมีอะไรบ้าง"   -> goes to low_stock (different pattern)
 *   "คงเหลือทั้งหมด"
 */
export function isStockSummaryQuestion(text: string): boolean {
  // Broader catch-all for summary phrases (with or without spaces, with or without สต็อก/สต็อ็ก)
  const hasSummary = /(สรุปสถานะ?|สรุป|ภาพรวม|สถานะ?|สต็อก?|คงเหลือทั้งหมด|เหลือทั้งหมด|หมดกี่ตัว|stock\s*summary)/i.test(text);
  // Quantity questions (Case 1 in ruleFallback) take priority
  const hasQuantityQuestion = isQuantityQuestion(text);
  return hasSummary && !hasQuantityQuestion;
}

/**
 * Detect if text is asking for low-stock items (parts near depletion).
 * These should route to low_stock intent.
 */
export function isLowStockQuestion(text: string): boolean {
  return /(หมด|ใกล้หมด|ต่ำกว่าขั้นต่ำ|ต้องเติม|อะไรหมด|อันไหนใกล้หมด)/i.test(text);
}

/**
 * Full intent detection with low_stock support.
 * Expands normalizeIntentRuleFallback to include low_stock patterns.
 */
export function detectQuickIntent(text: string): NormalizedIntent | null {
  const filters = extractInventoryFilters(text);

  // Case 1: total/summary → stock_summary (check before low_stock so "คงเหลือทั้งหมด" → summary)
  if (isStockTotalQuestion(text)) {
    return {
      intent: "stock_summary",
      keyword: null,
      plant: filters.plant,
      buildingName: filters.buildingName,
      categoryName: null,
      from: null,
      to: null,
      confidence: 0.9,
    };
  }

  // Case 2: low_stock
  if (isLowStockQuestion(text)) {
    return {
      intent: "low_stock",
      keyword: filters.keyword,
      plant: filters.plant,
      buildingName: filters.buildingName,
      categoryName: null,
      from: null,
      to: null,
      confidence: 0.9,
    };
  }

  // Case 3: quantity/part-specific → stock_summary (DB aggregates with keyword)
  if (isQuantityQuestion(text)) {
    return {
      intent: "stock_summary",
      keyword: filters.keyword,
      plant: filters.plant,
      buildingName: filters.buildingName,
      categoryName: null,
      from: null,
      to: null,
      confidence: 0.9,
    };
  }

  // Case 4: summary without keyword → stock_summary
  if (isStockSummaryQuestion(text)) {
    return {
      intent: "stock_summary",
      keyword: null,
      plant: filters.plant,
      buildingName: filters.buildingName,
      categoryName: null,
      from: null,
      to: null,
      confidence: 0.9,
    };
  }

  return null;
}

/**
 * Detect if a text is asking "how much of X is left?" or "how many X?"
 * These are quantity questions about a specific keyword and should be routed
 * to stock_summary *with* keyword filter, NOT a generic inventory_search.
 * Examples:
 *   "contactor เหลือเท่าไหร่ Block 1"
 *   "เบรกเกอร์ มีกี่ตัว"
 *   "LC1D40AP7 คงเหลือเท่าไหร่"
 */
export function isQuantityQuestion(text: string): boolean {
  return /(เหลือเท่าไหร่|มีกี่ตัว|มีเท่าไหร่|คงเหลือเท่าไหร่|หมดกี่ตัว|ยอดคงเหลือ|จำนวนคงเหลือ|เหลือกี่)/i.test(text);
}

export function isStockTotalQuestion(text: string): boolean {
  return /(เหลือทั้งหมด|คงเหลือทั้งหมด|สรุปภาพรวม|สถานะสต็อก|สรุปสถานะ)/i.test(text);
}

/**
 * Extract a keyword from inventory text by stripping known noise words.
 * Returns null if nothing meaningful remains.
 */
export function extractPartKeyword(text: string): string | null {
  const cleaned = text
    // Remove quantity/summary noise
    .replace(/(สรุปสถานะ|สรุป|ภาพรวม|สถานะสต็อก|สถานะ|สต็อก|คงเหลือ|เหลือเท่าไหร่|มีกี่ตัว|มีเท่าไหร่|เหลือทั้งหมด|ทั้งหมด|หมดกี่ตัว|มีอะไรบ้าง|มีอะไร|อะไรบ้าง|เท่าไหร่|เหลือ|ใกล้หมด|ต่ำกว่าขั้นต่ำ|ต้องเติม|อะไรหมด|อันไหนใกล้หมด|ค้นหา|หา|ดู|เช็ค|ตรวจสอบ|ตรวจ|มีไหม|หรือเปล่า|หรือยัง|ไหม|ไม่|ครับ|ค่ะ|นะ|จ้ะ|จ๊ะ|น่ะ|ตอนนี้|ปัจจุบัน)/gi, "")
    // Remove locators
    .replace(/(?:บล็อค|บล็อก|block|บล้อค)\s*\S+/gi, "")
    .replace(/(?:อาคาร|ตึก)\s*\S+/gi, "")
    .replace(/ใน\s*/gi, "")
    // Remove standalone Thai particles/grammar (repeated)
    .replace(/\b(อะไร|บ้าง|ตอน|นี้|ไหม|ยัง|ครับ|ค่ะ|นะ|จ้ะ|จ๊ะ|น่ะ|ใน|ของ|ที่)\b/gi, "")
    // Collapse spaces
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.length < 2) return null;
  // Treat overly-generic "part" keywords as no keyword
  if (/^(อะไหล่|spare\s*part|parts?)$/i.test(cleaned)) return null;
  return cleaned;
}

/**
 * Extract plant/building/keyword from user text deterministically.
 * Used by the rule-based pre-router before LLM normalization.
 */
export function extractInventoryFilters(text: string): {
  keyword: string | null;
  plant: string | null;
  buildingName: string | null;
  categoryName: string | null;
} {
  // Plant — with optional space between prefix and number (e.g. "บล็อค1" or "บล็อค 1")
  const plantMatch = text.match(/(?:บล็อค|บล็อก|block|บล้อค)\s*(\d+|SPECIAL\s*PART)/i);
  const plant = plantMatch?.[1]?.trim() ?? null;

  // Building
  const buildingMatch = text.match(/(?:อาคาร|ตึก\s*)?(ท\.?\d{3})/i);
  const buildingName = buildingMatch ? normalizeBuildingName(buildingMatch[1]) : null;

  // Keyword
  const keyword = extractPartKeyword(text);

  return { keyword, plant, buildingName, categoryName: null };
}

/**
 * Rule-based fallback: map quantity/summary questions directly to
 * stock_summary intents without calling the LLM.
 * Returns null when no rule matches (fall through to existing classifier).
 */
export function normalizeIntentRuleFallback(text: string): NormalizedIntent | null {
  const filters = extractInventoryFilters(text);

  // ── Case 1: "how much of X is left?" → stock_summary with keyword
  if (isQuantityQuestion(text)) {
    return {
      intent: "stock_summary",
      keyword: filters.keyword,
      plant: filters.plant,
      buildingName: filters.buildingName,
      categoryName: null,
      from: null,
      to: null,
      confidence: 0.9,
    };
  }

  // ── Case 2: "summary of stock at block X building Y" → stock_summary (no keyword)
  if (isStockSummaryQuestion(text)) {
    return {
      intent: "stock_summary",
      keyword: null,
      plant: filters.plant,
      buildingName: filters.buildingName,
      categoryName: null,
      from: null,
      to: null,
      confidence: 0.9,
    };
  }

  return null;
}

// ── Term detection helpers (regex, no LLM needed) ───────────────────

const SUMMARY_PATTERN =
  /(สรุป|ภาพรวม|สถานะ|ใกล้หมด|ต่ำกว่าขั้นต่ำ|ต้องเติม|คงเหลือ|เหลือเท่าไหร่|หมดกี่ตัว|สต็อกเท่าไหร่|stock\s*summary|low\s*stock)/i;

const LOCATOR_PATTERN =
  /(บล็อค|บล็อก|block|บล้อค|อาคาร|ตึก|ท\.\d+|building|plant)/i;

const TREND_PATTERN =
  /(เดือนนี้|สัปดาห์นี้|ปีนี้|แนวโน้ม|สถิติ|ใช้ไป|กี่ครั้ง|usage|trend|ประวัติ|เบิก|movement)/i;

const INVENTORY_PATTERN =
  /(contactor|breaker|เบรกเกอร์|คอนแทคเตอร์|เบรคเกอร์|relay|รีเลย์|อะไหล่|spare\s*part|motor|มอเตอร์|pump|ปั้ม|valve|วาล์ว|cable|สายไฟ|fuse|ฟิวส์|sensor|เซนเซอร์|switch|สวิตช์|[A-Z]{2,}\d[A-Z\d-]{2,}|ท\.\d{3}|บล็อค\s*\d|บล็อก\s*\d|block\s*\d|อาคาร\s*ท\.?\d{3})/i;

// Regex to extract plant number from Thai/English text
const PLANT_PATTERN = /(?:บล็อค|บล็อก|block|บล้อค)\s*(\d+|SPECIAL\s*PART)/i;

// Regex to extract building reference (with or without prefix)
const BUILDING_PATTERN = /(?:อาคาร|ตึก\s*)?(ท\.?\d{3})/i;

export function hasSummaryTerms(text: string): boolean {
  return SUMMARY_PATTERN.test(text);
}

export function hasLocatorTerms(text: string): boolean {
  return LOCATOR_PATTERN.test(text);
}

export function hasTrendTerms(text: string): boolean {
  return TREND_PATTERN.test(text);
}

/**
 * Quick check: should we try LLM normalization for this text?
 * Returns true if text contains summary, locator, trend, or quantity keywords.
 */
export function shouldNormalize(text: string): boolean {
  return hasSummaryTerms(text) || hasLocatorTerms(text) || hasTrendTerms(text) || isQuantityQuestion(text);
}

// ── Inventory content detection ─────────────────────────────────────

/**
 * Check if text contains inventory-related content beyond just trend/locator words.
 * Used to decide whether trend/history fallback is warranted.
 */
export function hasInventoryContent(text: string): boolean {
  return INVENTORY_PATTERN.test(text);
}

// ── Regex-based fallback when LLM returns general_chat ──────────────

/**
 * When LLM returns general_chat/conf=0 but the text clearly has trend terms AND
 * inventory content, try regex-based extraction as fallback.
 *
 * Returns null if fallback is not warranted.
 */
export function normalizeIntentRegexFallback(text: string): NormalizedIntent | null {
  if (!hasTrendTerms(text)) return null;
  if (!hasInventoryContent(text)) return null;

  // Extract plant
  const plantMatch = text.match(PLANT_PATTERN);
  const plant = plantMatch?.[1]?.trim() ?? null;

  // Extract building name
  const buildingMatch = text.match(BUILDING_PATTERN);
  const buildingName = buildingMatch ? normalizeBuildingName(buildingMatch[1]) : null;

  // Extract keyword — remove trend/locator/prefix words, keep the rest
  let keyword: string | null = text
    .replace(/(เหลือเท่าไหร่|มีกี่ตัว|มีเท่าไหร่|คงเหลือ|เดือนนี้|สัปดาห์นี้|ปีนี้|แนวโน้ม|สถิติ|ใช้ไป|กี่ครั้ง|usage|trend|ประวัติ|เบิก|movement|ไปเยอะไหม|หรือเปล่า|ไหม|ครับ|ค่ะ|นะ|จ้ะ)/gi, "")
    .replace(/(?:บล็อค|บล็อก|block|บล้อค)\s*\S+/gi, "")
    .replace(/(?:อาคาร|ตึก)\s*\S+/gi, "")
    .replace(/ใน\s*/gi, "")
    .trim();

  if (!keyword || keyword.length < 2) keyword = null;

  return {
    intent: "usage_trend",
    keyword,
    plant,
    buildingName,
    categoryName: null,
    from: null,
    to: null,
    confidence: 0.8,
  };
}

// ── Building name normalization ─────────────────────────────────────

/**
 * Normalize a building name from LLM output or user text to the DB format.
 *
 * Rules:
 * - null/empty → null
 * - trim, remove prefix "อาคาร" / "ตึก"
 * - "003" → "ท.003"     (bare 3-digit number)
 * - "ท003" → "ท.003"    (missing dot)
 * - "ท.003" → "ท.003"   (already correct)
 * - Other format → trimmed string as-is
 */
export function normalizeBuildingName(value: string | null | undefined): string | null {
  if (!value) return null;
  let s = value.trim();
  if (!s) return null;

  // Remove Thai prefix words
  s = s.replace(/^(อาคาร|ตึก)\s*/i, "").trim();

  // Bare 3-digit number → add "ท." prefix
  if (/^\d{3}$/.test(s)) {
    return `ท.${s}`;
  }

  // "ท003" (Thai letter + 3 digits, no dot) → "ท.003"
  const matchNoDot = s.match(/^(ท)(\d{3})$/);
  if (matchNoDot) {
    return `${matchNoDot[1]}.${matchNoDot[2]}`;
  }

  // Already "ท.xxx" — return as-is
  return s;
}
