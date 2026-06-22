/**
 * Plain-text renderers for AI tool results, used by the web assistant
 * stream path when the LLM summarization round is unreliable (e.g. weak
 * models echo back raw JSON). Each function takes a structured tool result
 * and returns a concise Thai text reply suitable for chat display.
 */

import type {
  SearchPartsResult,
  StockSummaryResult,
  LowStockResult,
  MovementResult,
  TrendResult,
  CleanPart,
} from "./db-tools";
import type { WebSearchResult } from "./web-search";

function partStatusLine(p: CleanPart): string {
  const status =
    p.quantity <= 0 ? "❌ หมด" : p.quantity <= p.minimumQuantity ? "⚠️ ต่ำ" : "✅";
  return `  ${status} ${p.partNumber} — ${p.partName} (${p.quantity} ${p.unit})`;
}

export function renderStockSummaryText(result: StockSummaryResult): string {
  const filters: string[] = [];
  if (result.plant) filters.push(`บล็อค ${result.plant}`);
  if (result.buildingName) filters.push(`อาคาร ${result.buildingName}`);
  if (result.categoryName) filters.push(result.categoryName);
  if (result.keyword) filters.push(`"${result.keyword}"`);

  const filterText = filters.length > 0 ? ` (${filters.join(", ")})` : "";

  const lines = [
    `📊 สรุปสถานะสต็อก${filterText}`,
    `รายการทั้งหมด: ${result.totalParts}`,
    `จำนวนรวม: ${result.totalQuantity}`,
    `คงเหลือปกติ: ${result.inStockCount} | ต่ำกว่าขั้นต่ำ: ${result.lowStockCount} | หมด: ${result.outOfStockCount}`,
  ];

  if (result.breakdown.length > 0 && result.totalParts > 0) {
    lines.push("");
    lines.push("แยกตามอาคาร:");
    for (const b of result.breakdown.slice(0, 5)) {
      lines.push(`  🏢 ${b.buildingName}: ${b.totalParts} รายการ, ${b.totalQuantity} ชิ้น`);
    }
  }

  if (result.examples.length > 0) {
    lines.push("");
    lines.push("ตัวอย่างอะไหล่:");
    for (const p of result.examples.slice(0, 8)) {
      lines.push(partStatusLine(p));
    }
  }

  return lines.join("\n");
}

export function renderSearchResultText(result: SearchPartsResult): string {
  if (result.totalCount === 0) {
    return `🔍 ไม่พบ "${result.keyword}" ในคลัง`;
  }

  const lines = [
    `🔍 พบ ${result.totalCount} รายการ สำหรับ "${result.keyword}" (จำนวนรวม ${result.totalQuantity} ชิ้น)`,
  ];

  if (result.parts.length > 0) {
    lines.push("");
    for (const p of result.parts.slice(0, 10)) {
      lines.push(partStatusLine(p));
    }
    if (result.totalCount > 10) {
      lines.push(`  ... และอีก ${result.totalCount - 10} รายการ`);
    }
  }

  return lines.join("\n");
}

export function renderLowStockText(result: LowStockResult): string {
  if (result.totalCount === 0) {
    return "✅ ไม่มีอะไหล่ที่ต่ำกว่าขั้นต่ำในขณะนี้";
  }

  const filters: string[] = [];
  if (result.plant) filters.push(`บล็อค ${result.plant}`);
  if (result.buildingName) filters.push(`อาคาร ${result.buildingName}`);
  if (result.categoryName) filters.push(result.categoryName);
  const filterText = filters.length > 0 ? ` (${filters.join(", ")})` : "";

  const lines = [`⚠️ อะไหล่ที่ต่ำกว่าขั้นต่ำ${filterText}: ${result.totalCount} รายการ`];

  if (result.parts.length > 0) {
    lines.push("");
    for (const p of result.parts.slice(0, 15)) {
      lines.push(partStatusLine(p));
    }
  }

  return lines.join("\n");
}

export function renderMovementsText(result: MovementResult): string {
  if (result.totalCount === 0) {
    return `📋 ไม่พบประวัติการเคลื่อนไหว${result.filters ? ` ${result.filters}` : ""}`;
  }

  const lines = [`📋 ประวัติการเคลื่อนไหว${result.filters ? ` ${result.filters}` : ""}: ${result.totalCount} รายการ`];

  if (result.movements.length > 0) {
    lines.push("");
    for (const m of result.movements.slice(0, 10)) {
      const sign = m.quantityChange >= 0 ? "+" : "";
      const typeLabel =
        m.type === "STOCK_IN" ? "รับ" : m.type === "STOCK_OUT" ? "เบิก" : "ปรับ";
      lines.push(
        `  ${typeLabel} ${m.partNumber} — ${m.partName}: ${sign}${m.quantityChange} (เหลือ ${m.quantityAfter}) โดย ${m.userName ?? "?"}`,
      );
    }
  }

  return lines.join("\n");
}

export function renderTrendsText(result: TrendResult): string {
  const lines = [`📈 สถิติการใช้งาน${result.filters ? ` ${result.filters}` : ""}`];

  if (result.summary) {
    lines.push("");
    lines.push(result.summary);
  }

  if (result.monthly.length > 0) {
    lines.push("");
    for (const m of result.monthly.slice(0, 12)) {
      lines.push(
        `  ${m.yearMonth}: รับ ${m.totalIn} | เบิก ${m.totalOut} | ปรับ ${m.adjustmentCount} ครั้ง`,
      );
    }
  }

  return lines.join("\n");
}

export function renderWebSearchText(result: WebSearchResult): string {
  const query = result.query || "";
  if (!result.results || result.results.length === 0) {
    const note = result.summary ? `\n${result.summary}` : "";
    return `🔍 ไม่พบข้อมูลจากเว็บสำหรับ "${query}"${note}`.trimEnd();
  }
  const lines = [`🔍 ข้อมูลจากเว็บสำหรับ "${query}" (${result.totalCount} ผล):`];
  if (result.summary && result.summary !== `พบ ${result.results.length} ผลลัพธ์จากเว็บ`) {
    lines.push("", result.summary);
  }
  lines.push("");
  for (const r of result.results.slice(0, 5)) {
    lines.push(`• ${r.title} — ${r.sourceDomain}`);
    if (r.snippet) lines.push(`  ${r.snippet.slice(0, 180)}`);
  }
  return lines.join("\n");
}

/**
 * Format any known tool result into plain text by tool name.
 * Returns null for unknown tools (caller should fall back to LLM).
 */
export function formatToolResultAsText(
  toolName: string,
  result: unknown,
): string | null {
  if (!result || typeof result !== "object") return null;

  switch (toolName) {
    case "get_stock_summary":
      return renderStockSummaryText(result as StockSummaryResult);
    case "search_parts":
      return renderSearchResultText(result as SearchPartsResult);
    case "get_low_stock":
      return renderLowStockText(result as LowStockResult);
    case "get_part_movements":
      return renderMovementsText(result as MovementResult);
    case "get_usage_trends":
      return renderTrendsText(result as TrendResult);
    case "web_search":
      return renderWebSearchText(result as WebSearchResult);
    default:
      return null;
  }
}
