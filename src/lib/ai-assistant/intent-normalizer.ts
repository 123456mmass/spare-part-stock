/**
 * Lightweight helpers for extracting inventory filters from Thai/English text.
 *
 * The LINE webhook now routes all text messages through the LLM orchestrator,
 * so this module no longer contains a separate deterministic pre-router.
 * It keeps shared utilities (filter extraction, building normalization,
 * term detection) that the orchestrator tools, tests, and legacy callers use.
 */

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

// ── Deterministic filter extraction ───────────────────────────────────

/**
 * Extract a keyword from inventory text by stripping known noise words.
 * Returns null if nothing meaningful remains.
 */
export function extractPartKeyword(text: string): string | null {
  const cleaned = text
    // Strip stray quotation marks from LINE auto-complete/selection
    .replace(/[""''`]/g, "")
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
 * Shared helper used by the orchestrator tools and other callers.
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

// ── Term detection helpers (regex, no LLM needed) ───────────────────

const SUMMARY_PATTERN =
  /(สรุป|ภาพรวม|สถานะ|ใกล้หมด|ต่ำกว่าขั้นต่ำ|ต้องเติม|คงเหลือ|เหลือเท่าไหร่|หมดกี่ตัว|สต็อกเท่าไหร่|stock\s*summary|low\s*stock)/i;

const LOCATOR_PATTERN =
  /(บล็อค|บล็อก|block|บล้อค|อาคาร|ตึก|ท\.\d+|building|plant)/i;

const TREND_PATTERN =
  /(เดือนนี้|สัปดาห์นี้|ปีนี้|แนวโน้ม|สถิติ|ใช้ไป|กี่ครั้ง|usage|trend|ประวัติ|เบิก|movement)/i;

const INVENTORY_PATTERN =
  /(contactor|breaker|เบรกเกอร์|คอนแทคเตอร์|เบรคเกอร์|relay|รีเลย์|อะไหล่|spare\s*part|motor|มอเตอร์|pump|ปั้ม|valve|วาล์ว|cable|สายไฟ|fuse|ฟิวส์|sensor|เซนเซอร์|switch|สวิตช์|stock|สต็อก|stocks|[A-Z]{2,}\d[A-Z\d-]{2,}|ท\.\d{3}|บล็อค\s*\d|บล็อก\s*\d|block\s*\d|อาคาร\s*ท\.?\d{3})/i;

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
 * Check if text contains inventory-related content beyond just trend/locator words.
 */
export function hasInventoryContent(text: string): boolean {
  return INVENTORY_PATTERN.test(text);
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
