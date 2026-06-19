/**
 * Build LINE reply messages from an orchestrator result.
 *
 * Produces a natural text message from the LLM reply plus a structured Flex
 * card when a read tool was invoked and we have a matching visual renderer.
 */

import { createTextMessage, createFlexMessage } from "@/lib/line";
import {
  createSearchResultsFlex,
  createStockSummaryFlex,
  createLowStockFlex,
  createBuildingListFlex,
  createBlockListFlex,
  createPartDetailFlex,
  createPartMovementsFlex,
  createUsageTrendsFlex,
  createWebSearchResultsFlex,
} from "@/lib/line-chat/flex-messages";
import type {
  SearchPartsResult,
  StockSummaryResult,
  LowStockResult,
  BuildingResult,
  BlockResult,
  MovementResult,
  TrendResult,
  ImageSearchResult,
} from "@/lib/ai-assistant/db-tools";
import type { WebSearchResult } from "@/lib/ai-assistant/web-search";
import type { AssistantToolCall, AiAssistantResult } from "@/lib/ai-assistant/types";

type LineMessage =
  | ReturnType<typeof createTextMessage>
  | ReturnType<typeof createFlexMessage>;

export function buildAssistantMessages(
  result: { reply: string; toolCalls?: AssistantToolCall[] },
): LineMessage[] {
  const flex = buildFlexForToolCalls(result.toolCalls);
  if (flex) {
    // When we have a structured data card, the Flex already shows the answer.
    // Sending duplicate text feels robotic; use just the card.
    return [createFlexMessage(flex.altText, flex.contents)];
  }

  return [createTextMessage(result.reply)];
}

const FALLBACK_ALT_TEXT = "สรุปข้อมูลจากระบบสต็อก";

function buildFlexForToolCalls(toolCalls?: AssistantToolCall[]): {
  altText: string;
  contents: unknown;
} | null {
  if (!toolCalls || toolCalls.length === 0) return null;

  // Prefer the primary read tool that the reply is most likely about.
  // If conflicting tools were called (e.g. search_parts + get_stock_summary),
  // prefer get_stock_summary because the reply's aggregate numbers ("รวม X ชิ้น")
  // match the stock-summary card better than the search-parts carousel.
  const hasSummary = toolCalls.some((t) => t.name === "get_stock_summary");
  const hasLowStock = toolCalls.some((t) => t.name === "get_low_stock");
  const hasSearch = toolCalls.some((t) => t.name === "search_parts");

  const preferredOrder = [
    hasSummary ? "get_stock_summary" : null,
    hasLowStock ? "get_low_stock" : null,
    hasSearch ? "search_parts" : null,
    "get_part_detail",
  ].filter(Boolean) as string[];

  const main = toolCalls.find((t) => preferredOrder.includes(t.name)) ?? toolCalls[toolCalls.length - 1];

  switch (main.name) {
    case "get_stock_summary": {
      const data = main.result as StockSummaryResult | undefined;
      if (!data) return null;
      const filters: string[] = [];
      if (data.plant) filters.push(`บล็อค ${data.plant}`);
      if (data.buildingName) filters.push(`อาคาร ${data.buildingName}`);
      if (data.categoryName) filters.push(data.categoryName);
      if (data.keyword) filters.push(`"${data.keyword}"`);
      const filterText = filters.length > 0 ? ` (${filters.join(", ")})` : "";
      return {
        altText: `สรุปสต็อก${filterText}` || FALLBACK_ALT_TEXT,
        contents: createStockSummaryFlex(data, filterText),
      };
    }

    case "search_parts": {
      const data = main.result as SearchPartsResult | undefined;
      if (!data) return null;
      const flexParts = data.parts.map((p) => ({
        id: "", // search result does not expose DB id for detail link
        partNumber: p.partNumber,
        partName: p.partName,
        quantity: p.quantity,
        minimumQuantity: p.minimumQuantity,
        unit: p.unit,
        location: p.location,
        plant: p.plant,
        category: p.categoryName ? { name: p.categoryName } : null,
        building: p.buildingName ? { name: p.buildingName } : null,
      }));
      return {
        altText: (data.keyword ? `ค้นหา ${data.keyword}` : FALLBACK_ALT_TEXT),
        contents: createSearchResultsFlex(data.keyword, flexParts),
      };
    }

    case "get_low_stock": {
      const data = main.result as LowStockResult | undefined;
      if (!data) return null;
      const flexParts = data.parts.map((p) => ({
        id: "",
        partNumber: p.partNumber,
        partName: p.partName,
        quantity: p.quantity,
        minimumQuantity: p.minimumQuantity,
        unit: p.unit,
        location: p.location,
        plant: p.plant,
        category: p.categoryName ? { name: p.categoryName } : null,
        building: p.buildingName ? { name: p.buildingName } : null,
      }));
      return {
        altText: `อะไหล่ต่ำกว่าขั้นต่ำ (${data.totalCount} รายการ)`,
        contents: createLowStockFlex(flexParts, data.totalCount),
      };
    }

    case "get_part_detail": {
      const data = main.result as import("@/lib/ai-assistant/db-tools").CleanPart | null | undefined;
      if (!data) return null;
      return {
        altText: `${data.partNumber} — ${data.partName}`,
        contents: createPartDetailFlex({
          id: "",
          partNumber: data.partNumber,
          partName: data.partName,
          quantity: data.quantity,
          minimumQuantity: data.minimumQuantity,
          unit: data.unit,
          location: data.location,
          plant: data.plant,
          category: data.categoryName ? { name: data.categoryName } : null,
          building: data.buildingName ? { name: data.buildingName } : null,
        }),
      };
    }

    case "list_buildings": {
      const data = main.result as BuildingResult | undefined;
      if (!data) return null;
      return {
        altText: `อาคารทั้งหมด (${data.totalCount} แห่ง)`,
        contents: createBuildingListFlex(data.buildings.map((b) => ({ name: b.name, partCount: b.partCount }))),
      };
    }

    case "list_blocks": {
      const data = main.result as BlockResult | undefined;
      if (!data) return null;
      return {
        altText: `Block ทั้งหมด (${data.totalCount} แห่ง)`,
        contents: createBlockListFlex(data.blocks),
      };
    }

    case "get_part_movements": {
      const data = main.result as MovementResult | undefined;
      if (!data) return null;
      return {
        altText: `ประวัติการเคลื่อนไหว (${data.totalCount} รายการ)`,
        contents: createPartMovementsFlex(data.movements, data.totalCount, data.filters),
      };
    }

    case "get_usage_trends": {
      const data = main.result as TrendResult | undefined;
      if (!data) return null;
      return {
        altText: `แนวโน้มการใช้งาน`,
        contents: createUsageTrendsFlex(data.monthly, data.summary, data.filters),
      };
    }

    case "search_by_image": {
      const data = main.result as ImageSearchResult | undefined;
      if (!data) return null;
      const flexParts = data.parts.map((p) => ({
        id: "",
        partNumber: p.partNumber,
        partName: p.partName,
        quantity: p.quantity,
        minimumQuantity: p.minimumQuantity,
        unit: p.unit,
        location: p.location,
        plant: p.plant,
        category: p.categoryName ? { name: p.categoryName } : null,
        building: p.buildingName ? { name: p.buildingName } : null,
      }));
      return {
        altText: data.totalCount > 0 ? `ค้นหาจากรูป (${data.totalCount} รายการ)` : "ไม่พบอะไหล่จากรูป",
        contents: createSearchResultsFlex(data.keyword || "รูปภาพ", flexParts),
      };
    }

    case "web_search": {
      const data = main.result as WebSearchResult | undefined;
      if (!data) return null;
      return {
        altText: data.totalCount > 0 ? `ค้นเว็บ: ${data.query} (${data.totalCount} ผล)` : `ค้นเว็บ: ${data.query}`,
        contents: createWebSearchResultsFlex(data.query, data.results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          sourceDomain: r.sourceDomain,
          score: r.score,
        }))),
      };
    }

    default:
      return null;
  }
}

/** Which tool names have a Flex card renderer? */
export const FLEX_RENDERER_TOOLS = new Set([
  "get_stock_summary",
  "get_low_stock",
  "search_parts",
  "get_part_detail",
  "get_part_movements",
  "get_usage_trends",
  "list_buildings",
  "list_blocks",
  "search_by_image",
  "web_search",
]);

export function hasFlexRenderer(toolName: string): boolean {
  return FLEX_RENDERER_TOOLS.has(toolName);
}
