/**
 * Response renderers for LINE AI Assistant.
 *
 * Each function takes a DB tool result and returns an array of LINE message objects
 * ready for sendLineReply(). Never expose raw Prisma objects.
 */

import { createTextMessage, createFlexMessage } from "@/lib/line";
import {
  createSearchResultsFlex,
  createStockSummaryFlex,
  createLowStockFlex,
} from "@/lib/line-chat/flex-messages";
import type {
  SearchPartsResult,
  StockSummaryResult,
  LowStockResult,
  MovementResult,
  TrendResult,
} from "./db-tools";

// ── Message type ────────────────────────────────────────────────────

type LineMessage =
  | ReturnType<typeof createTextMessage>
  | ReturnType<typeof createFlexMessage>;

// ── 1. Stock summary ────────────────────────────────────────────────

export function renderStockSummary(
  result: StockSummaryResult,
): LineMessage[] {
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

  if (result.examples.length > 0) {
    lines.push("");
    lines.push("ตัวอย่างอะไหล่:");
    for (const p of result.examples.slice(0, 5)) {
      const status =
        p.quantity <= 0 ? "❌ หมด" : p.quantity <= p.minimumQuantity ? "⚠️ ต่ำ" : "✅";
      lines.push(`  ${status} ${p.partNumber} — ${p.partName} (${p.quantity} ${p.unit})`);
    }
  }

  return [
    createFlexMessage(
      `สรุปสต็อก${filterText}`,
      createStockSummaryFlex(result, filterText),
    ),
    createTextMessage(lines.join("\n")),
  ];
}

// ── 2. Low stock ────────────────────────────────────────────────────

export function renderLowStock(result: LowStockResult): LineMessage[] {
  const filters: string[] = [];
  if (result.plant) filters.push(`บล็อค ${result.plant}`);
  if (result.buildingName) filters.push(`อาคาร ${result.buildingName}`);
  if (result.categoryName) filters.push(result.categoryName);
  const filterText = filters.length > 0 ? ` (${filters.join(", ")})` : "";

  if (result.totalCount === 0) {
    return [
      createTextMessage(`✅ ไม่มีอะไหล่ที่ต่ำกว่าขั้นต่ำ${filterText}`),
    ];
  }

  const lines = [
    `⚠️ อะไหล่ต่ำกว่าขั้นต่ำ${filterText}: ${result.totalCount} รายการ`,
  ];

  for (const p of result.parts.slice(0, 10)) {
    const emoji = p.quantity <= 0 ? "❌" : "⚠️";
    const pct = p.minimumQuantity > 0
      ? Math.round((p.quantity / p.minimumQuantity) * 100)
      : 0;
    lines.push(
      `  ${emoji} ${p.partNumber} — ${p.partName}: ${p.quantity}/${p.minimumQuantity} ${p.unit} (${pct}%)`,
    );
  }

  return [
    createFlexMessage(
      `อะไหล่ต่ำกว่าขั้นต่ำ${filterText}`,
      createLowStockFlex(result.parts, result.totalCount),
    ),
    createTextMessage(lines.join("\n")),
  ];
}

// ── 3. Movements ────────────────────────────────────────────────────

export function renderMovements(result: MovementResult): LineMessage[] {
  if (result.totalCount === 0) {
    return [createTextMessage(`ไม่พบประวัติการเคลื่อนไหวสต็อก (${result.filters})`)];
  }

  const lines = [
    `📋 ประวัติสต็อก: ${result.totalCount} รายการ | ${result.filters}`,
    "",
  ];

  for (const m of result.movements.slice(0, 10)) {
    const typeEmoji =
      m.type === "STOCK_IN" ? "📥" : m.type === "STOCK_OUT" ? "📤" : "🔧";
    const sign = m.quantityChange >= 0 ? "+" : "";
    const date = new Date(m.createdAt).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    lines.push(
      `${typeEmoji} ${date} ${m.partNumber} — ${m.partName} ${sign}${m.quantityChange} (${m.quantityBefore}→${m.quantityAfter})${m.userName ? ` โดย ${m.userName}` : ""}${m.note ? ` — ${m.note}` : ""}`,
    );
  }

  return [createTextMessage(lines.join("\n"))];
}

// ── 4. Usage trends ─────────────────────────────────────────────────

export function renderTrends(result: TrendResult): LineMessage[] {
  const lines = [
    `📈 ${result.summary}`,
    result.filters ? `ตัวกรอง: ${result.filters}` : "",
    "",
  ];

  if (result.monthly.length === 0) {
    lines.push("ไม่มีข้อมูลการเคลื่อนไหวในช่วงนี้");
  } else {
    lines.push("รายเดือน:");
    for (const m of result.monthly) {
      const [y, mo] = m.yearMonth.split("-");
      const monthNames = [
        "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
        "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
      ];
      const label = `${monthNames[Number(mo) - 1]} ${y}`;
      lines.push(
        `  ${label}: รับ ${m.totalIn} (${m.stockInCount} ครั้ง) | เบิก ${m.totalOut} (${m.stockOutCount} ครั้ง) | ปรับ ${m.adjustmentCount} ครั้ง`,
      );
    }
  }

  return [createTextMessage(lines.filter(Boolean).join("\n"))];
}

// ── 5. Search ───────────────────────────────────────────────────────

export function renderSearchResult(result: SearchPartsResult): LineMessage[] {
  if (result.totalCount === 0) {
    return [
      createTextMessage(`🔍 ไม่พบ "${result.keyword}" ในคลัง`),
    ];
  }

  const lines = [
    `🔍 ค้นหา "${result.keyword}" พบ ${result.totalCount} รายการ`,
  ];

  for (const p of result.parts.slice(0, 5)) {
    const status =
      p.quantity <= 0 ? "❌ หมด" : p.quantity <= p.minimumQuantity ? "⚠️ ต่ำ" : "✅";
    const loc = [p.buildingName, p.plant].filter(Boolean).join(" ");
    lines.push(
      `  ${status} ${p.partNumber} — ${p.partName} (${p.quantity} ${p.unit})${loc ? ` [${loc}]` : ""}`,
    );
  }

  return [
    createFlexMessage(
      `ค้นหา ${result.keyword}`,
      createSearchResultsFlex(
        result.keyword,
        result.parts.map((p) => ({
          partNumber: p.partNumber,
          partName: p.partName,
          quantity: p.quantity,
          minimumQuantity: p.minimumQuantity,
          unit: p.unit,
          location: p.location,
          plant: p.plant,
          category: p.categoryName ? { name: p.categoryName } : null,
          building: p.buildingName ? { name: p.buildingName } : null,
        })),
      ),
    ),
    createTextMessage(lines.join("\n")),
  ];
}
